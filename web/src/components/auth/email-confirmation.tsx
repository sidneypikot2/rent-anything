"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { refreshSessionUser } from "@/lib/auth/actions";
import { useSession, type User } from "@/lib/auth/session";

// Email confirmation (RAA-215, the web half of RAA-214). A password account must confirm its
// email before it can check out or pay: the API answers 403 `email_unconfirmed` until then.

// An account with an email it hasn't confirmed. The API holds up only a password account
// (`User#email_confirmation_required?`), but /me doesn't say whether there is a password, so a
// Facebook-only account (whose email Facebook never vouches for) is reminded too; confirming is
// harmless for it. A guest without an account isn't asked.
export function needsEmailConfirmation(user: User | undefined) {
  return user !== undefined && user.registered && !user.email_confirmed && user.email !== null;
}

// The 403 a password account with an unconfirmed email gets from POST /checkouts and
// POST /bookings/pay: the sheets show EmailUnconfirmedNotice in its place.
export class EmailUnconfirmedError extends Error {}

export function emailUnconfirmed(response: Response, error: unknown) {
  return response.status === 403 && !!error && typeof error === "object" && "code" in error && error.code === "email_unconfirmed";
}

// POST /email_confirmation: emails the signed-in user the link again (limited per user and IP).
export function useResendConfirmation() {
  return useMutation({
    mutationFn: async () => {
      const { error, response } = await apiClient().POST("/api/v1/email_confirmation");
      if (response.status === 202) return;
      const body = error as { error?: string; errors?: string[] } | undefined;
      throw new Error(body?.error ?? body?.errors?.join(". ") ?? "Couldn't send the link. Try again.");
    },
  });
}

// "Confirm your email" with a button that sends the link again: over the cart, in the checkout
// and pay sheets after a 403, and on /confirm-email when a link has expired.
export function EmailUnconfirmedNotice({ email, intro, className }: { email: string | null; intro?: string; className?: string }) {
  const resend = useResendConfirmation();
  return (
    <div
      data-testid="email-unconfirmed"
      className={cn("flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-surface-2 px-4 py-3", className)}
    >
      <p className="min-w-0 flex-1 text-sm text-muted" role={resend.isSuccess ? "status" : undefined}>
        {resend.isSuccess ? (
          <>We&apos;ve sent a new link{email && <> to {email}</>}. It works for 24 hours.</>
        ) : (
          (intro ?? <>Please confirm your email: open the link we sent{email && <> to {email}</>}.</>)
        )}
      </p>
      {!resend.isSuccess && (
        <Button type="button" size="sm" variant="soft" data-testid="email-resend" loading={resend.isPending} onClick={() => resend.mutate()}>
          {resend.isPending ? "Sending…" : "Send the link again"}
        </Button>
      )}
      {resend.error && (
        <p role="alert" className="w-full text-sm text-danger">
          {resend.error.message}
        </p>
      )}
    </div>
  );
}

// Over the cart, for a signed-in account whose email isn't confirmed. The session's copy of the
// user may be stale (confirmed in another tab or on a phone), so it is read again once first.
export function EmailConfirmBanner({ className }: { className?: string }) {
  const session = useSession();
  const user = session?.user;
  const unconfirmed = needsEmailConfirmation(user);
  const checked = useRef(false);
  useEffect(() => {
    if (!unconfirmed || checked.current) return;
    checked.current = true;
    void refreshSessionUser();
  }, [unconfirmed]);

  if (!user || !unconfirmed) return null;
  return <EmailUnconfirmedNotice email={user.email} className={className} />;
}
