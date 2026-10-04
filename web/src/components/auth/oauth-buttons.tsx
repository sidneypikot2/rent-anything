"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { OauthProvider } from "@/lib/auth/actions";

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
};

export function hasOauthProviders() {
  return Boolean(GOOGLE_CLIENT_ID || FACEBOOK_APP_ID);
}

// "Continue with Google / Facebook". Each provider hands the browser a token, which the
// backend verifies (POST /api/v1/oauth/:provider) before signing the user in.
export function OauthButtons({ disabled, onToken }: Props) {
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
      text: "continue_with",
      width: googleButton.current.offsetWidth || 280,
    });
  }, [googleReady]);

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
    <div className="flex flex-col gap-2">
      {GOOGLE_CLIENT_ID && (
        <>
          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
            onReady={() => setGoogleReady(true)}
          />
          <div
            ref={googleButton}
            data-testid="oauth-google"
            className={disabled ? "pointer-events-none min-h-10 opacity-50" : "min-h-10"}
          />
        </>
      )}
      {FACEBOOK_APP_ID && (
        <>
          <Script src="https://connect.facebook.net/en_US/sdk.js" strategy="afterInteractive" />
          <Button
            type="button"
            variant="soft"
            size="sm"
            data-testid="oauth-facebook"
            disabled={disabled || !facebookReady}
            onClick={facebookLogin}
          >
            Continue with Facebook
          </Button>
        </>
      )}
    </div>
  );
}
