"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { refreshSessionUser } from "@/lib/auth/actions";
import { DASHBOARD_PATHS, LOGIN_PATHS, withNext } from "@/lib/auth/paths";
import { getSession, isAnonymous, useSession } from "@/lib/auth/session";
import { EmailUnconfirmedNotice, needsEmailConfirmation } from "./email-confirmation";
import { dropTokenFromUrl } from "./token-url";

type State = { step: "confirming" } | { step: "confirmed" } | { step: "failed"; error: string };

const INVALID_LINK = "That link is invalid or has expired. Ask for a new one.";

// /confirm-email?token=… (RAA-215): the link the confirmation email holds. Needs no sign-in, as it
// may open on another device. The token leaves the URL at once, so it isn't kept in the history
// or sent on in a Referer; a link that has expired offers a new one to a signed-in account.
export function ConfirmEmail({ token: initialToken }: { token?: string }) {
  const [token] = useState(initialToken);
  const [state, setState] = useState<State>(token ? { step: "confirming" } : { step: "failed", error: INVALID_LINK });
  const session = useSession();
  const sent = useRef(false);

  useEffect(() => {
    dropTokenFromUrl();
    if (!token || sent.current) return;
    sent.current = true;
    void (async () => {
      const { error, response } = await apiClient().POST("/api/v1/email_confirmation/verify", { body: { token } });
      if (response.ok) {
        setState({ step: "confirmed" });
        // The header and the cart's reminder follow, when it was this account.
        if (getSession() && !isAnonymous(getSession())) void refreshSessionUser();
        return;
      }
      const body = error as { error?: string; errors?: string[] } | undefined;
      setState({ step: "failed", error: body?.error ?? body?.errors?.join(". ") ?? INVALID_LINK });
    })();
  }, [token]);

  const signedIn = session && !isAnonymous(session) ? session : null;
  // Where to carry on: a guest's cart, where booking waited on this; signed out, sign-in.
  const next = !signedIn
    ? withNext(LOGIN_PATHS.guest, "/cart")
    : signedIn.user.role === "guest"
      ? "/cart"
      : DASHBOARD_PATHS[signedIn.user.role];

  return (
    <Card data-testid="confirm-email" className="w-full self-start">
      <CardBody pad="lg" className="flex flex-col gap-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          {state.step === "confirmed" ? "Email confirmed" : state.step === "failed" ? "Link not valid" : "Confirming your email…"}
        </h1>
        {state.step === "confirming" && (
          <p role="status" className="text-sm text-muted">
            One moment.
          </p>
        )}
        {state.step === "confirmed" && (
          <>
            <p role="status" data-testid="confirm-email-done" className="text-sm text-muted">
              Thanks — your email is confirmed. You can book and pay for your trips.
            </p>
            <ButtonLink href={next} size="sm">
              {!signedIn ? "Sign in" : signedIn.user.role === "guest" ? "Go to your cart" : "Continue"}
            </ButtonLink>
            {!signedIn && (
              <Link href={LOGIN_PATHS.partner} className="text-center text-sm font-semibold text-link underline">
                Partner sign-in
              </Link>
            )}
          </>
        )}
        {state.step === "failed" && (
          <>
            <p role="alert" data-testid="confirm-email-error" className="text-sm text-danger">
              {state.error}
            </p>
            {signedIn && needsEmailConfirmation(signedIn.user) ? (
              <EmailUnconfirmedNotice email={signedIn.user.email} intro="Links work for 24 hours. We can send you a new one." />
            ) : signedIn ? (
              <ButtonLink href={next} size="sm" variant="soft">
                Continue
              </ButtonLink>
            ) : (
              <p className="text-sm text-muted">
                <Link href={next} className="font-semibold text-link underline">
                  Sign in
                </Link>{" "}
                (or{" "}
                <Link href={LOGIN_PATHS.partner} className="font-semibold text-link underline">
                  as a partner
                </Link>
                ) and we&apos;ll offer to send you a new link.
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
