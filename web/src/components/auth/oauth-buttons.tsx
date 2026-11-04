"use client";

import Script from "next/script";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import type { OauthProvider } from "@/lib/auth/actions";
import { isInAppBrowser, openInBrowserHref } from "@/lib/in-app-browser";

// Each button appears only when its id is configured (web/.env.example).
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
const FACEBOOK_API_VERSION = "v21.0";

// The parts of Google Identity Services and the Facebook JS SDK used here.
type GoogleId = {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
};
type FacebookSdk = {
  init(options: { appId: string; version: string; cookie: boolean; xfbml: boolean }): void;
  login(
    callback: (response: { authResponse?: { accessToken: string } | null }) => void,
    options: { scope: string },
  ): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

type Props = {
  disabled: boolean;
  onToken: (provider: OauthProvider, token: string) => void;
  // Side by side, for a small sheet (RAA-253): two pills of one height with short labels, as
  // "Continue with Google" doesn't fit half a sheet.
  inline?: boolean;
};

export function hasOauthProviders() {
  return Boolean(GOOGLE_CLIENT_ID || FACEBOOK_APP_ID);
}

// The buttons shown, by name, for text about them: "Google", "Facebook" or "Google or Facebook".
export function oauthProviderNames() {
  return [GOOGLE_CLIENT_ID && "Google", FACEBOOK_APP_ID && "Facebook"].filter(Boolean).join(" or ");
}

// "Continue with Google / Facebook". Each provider hands the browser a token, which the
// backend verifies (POST /api/v1/oauth/:provider) before signing the user in.
const noSubscribe = () => () => {};

// The user agent, read only in the browser: the server renders as if it were unknown (null).
function useUserAgent() {
  return useSyncExternalStore(
    noSubscribe,
    () => navigator.userAgent,
    () => null,
  );
}

export function OauthButtons({ disabled, onToken, inline = false }: Props) {
  const userAgent = useUserAgent();
  // Google sign-in can't work inside an in-app browser (RAA-157), so there it gives way to a
  // way out; until the user agent is known its space is held and its script isn't loaded.
  const inApp = userAgent !== null && isInAppBrowser(userAgent);
  const googleButton = useRef<HTMLDivElement>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [facebookReady, setFacebookReady] = useState(false);
  // Read through a ref so the provider callbacks, registered once, see the latest one.
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleReady || !googleButton.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: ({ credential }) => onTokenRef.current("google", credential),
    });
    window.google.accounts.id.renderButton(googleButton.current, {
      theme: "outline",
      size: "large",
      text: inline ? "signin" : "continue_with",
      shape: inline ? "pill" : "rectangular",
      // The site is English only: otherwise Google follows the browser's language.
      locale: "en",
      width: googleButton.current.offsetWidth || 280,
    });
  }, [googleReady, inline]);

  useEffect(() => {
    if (!FACEBOOK_APP_ID) return;
    const init = () => {
      window.FB?.init({ appId: FACEBOOK_APP_ID, version: FACEBOOK_API_VERSION, cookie: false, xfbml: false });
      setFacebookReady(true);
    };
    if (window.FB) init();
    else window.fbAsyncInit = init;
  }, []);

  function facebookLogin() {
    // Called straight from the click so the popup isn't blocked.
    window.FB?.login(
      (response) => {
        const token = response.authResponse?.accessToken;
        if (token) onTokenRef.current("facebook", token);
      },
      { scope: "public_profile,email" },
    );
  }

  if (!hasOauthProviders()) return null;

  return (
    <div className={inline && !inApp ? "grid gap-2 sm:auto-cols-fr sm:grid-flow-col" : "flex flex-col gap-2"}>
      {GOOGLE_CLIENT_ID && userAgent === null && <div className="min-h-10" />}
      {GOOGLE_CLIENT_ID && userAgent !== null && inApp && <InAppBrowserNotice userAgent={userAgent} />}
      {GOOGLE_CLIENT_ID && userAgent !== null && !inApp && (
        <>
          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
            onReady={() => setGoogleReady(true)}
          />
          <div
            ref={googleButton}
            data-testid="oauth-google"
            className={cn("min-h-10 min-w-0", disabled && "pointer-events-none opacity-50")}
          />
        </>
      )}
      {FACEBOOK_APP_ID && (
        <>
          <Script src="https://connect.facebook.net/en_US/sdk.js" strategy="afterInteractive" />
          <Button
            type="button"
            variant="soft"
            size={inline ? "provider" : "sm"}
            data-testid="oauth-facebook"
            aria-label={inline ? "Continue with Facebook" : undefined}
            disabled={disabled || !facebookReady}
            onClick={facebookLogin}
          >
            {inline ? (
              <>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 fill-current">
                  <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12z" />
                </svg>
                Facebook
              </>
            ) : (
              "Continue with Facebook"
            )}
          </Button>
        </>
      )}
    </div>
  );
}

// In place of the Google button inside Messenger and the like: the way out to a real browser.
function InAppBrowserNotice({ userAgent }: { userAgent: string }) {
  const [copied, setCopied] = useState(false);
  const href = openInBrowserHref(window.location.href, userAgent);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }

  return (
    <div data-testid="oauth-google-in-app" className="flex flex-col gap-3 rounded-control bg-surface-2 p-3 text-sm">
      <p className="text-muted">
        Google sign-in doesn&apos;t work in this app&apos;s built-in browser.{" "}
        {href ? "Open this page in Chrome to use it." : "Tap the ⋯ menu and choose Open in browser to use it."}
      </p>
      <div className="flex flex-wrap gap-2">
        {href && (
          <ButtonLink href={href} prefetch={false} size="sm">
            Open in browser
          </ButtonLink>
        )}
        <Button type="button" variant="soft" size="sm" onClick={copyLink}>
          {copied ? "Link copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
