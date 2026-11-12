"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import type { SelfServeRole } from "@/lib/auth/actions";
import { FORGOT_PASSWORD_PATHS, LOGIN_PATHS, RESET_DONE_FLAG } from "@/lib/auth/paths";
import { clearSession, getSession, isAnonymous } from "@/lib/auth/session";
import { dropTokenFromUrl } from "./token-url";

// Choosing a new password by email (RAA-215, the web half of RAA-214): /forgot-password (guests)
// and /partner/forgot-password ask for the link; /reset-password?token=… sets the password.

// The same rule as the API's (User: 8 to 72 characters; bcrypt reads no further).
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

type ErrorBody = { error?: string; errors?: string[] } | undefined;

function message(error: unknown, fallback: string) {
  const body = error as ErrorBody;
  return body?.error ?? body?.errors?.join(". ") ?? fallback;
}

// POST /password_reset: the API answers 202 whether or not the email has an account of this role,
// so the page says "if" and never whether it has one. Only too many tries (429) is an error.
// A guest's page has no other heading; a partner's has its pitch's h1 beside the form.
export function ForgotPassword({ role }: { role: SelfServeRole }) {
  const Heading = role === "guest" ? "h1" : "h2";
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setPending(true);
    setError(undefined);
    try {
      const { error: failed, response } = await apiClient().POST("/api/v1/password_reset", { body: { email, role } });
      if (response.status === 202) setSentTo(email);
      else setError(message(failed, "Couldn't send the link. Try again."));
    } catch {
      setError("Couldn't send the link. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div data-testid="forgot-password" className="flex w-full flex-col gap-4">
      <Heading className="font-display text-2xl font-extrabold tracking-tight">Forgot your password?</Heading>
      {sentTo === null ? (
        <form method="post" onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-muted">Give the email you sign in with, and we&apos;ll send you a link to choose a new password.</p>
          <fieldset disabled={pending} className="flex flex-col gap-3">
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            {error && (
              <p role="alert" data-testid="forgot-password-error" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="sm">
              {pending ? "Sending…" : "Email me a link"}
            </Button>
          </fieldset>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p role="status" data-testid="forgot-password-sent" className="text-sm text-muted">
            If an account with a password exists for {sentTo}, we&apos;ve sent it a link. It works for 30 minutes, once. Nothing
            there? Check your spam folder.
          </p>
          <Button type="button" size="sm" variant="soft" onClick={() => setSentTo(null)}>
            Use another email
          </Button>
        </div>
      )}
      <p className="text-small text-muted">
        Remembered it?{" "}
        <Link href={LOGIN_PATHS[role]} className="font-semibold text-link underline">
          Sign in
        </Link>
        {role === "guest" && (
          <>
            {" "}
            · Booked without a password?{" "}
            <Link href="/login/code" className="font-semibold text-link underline">
              Sign in with a code
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

// /reset-password?token=… : the link the reset email holds. The token leaves the URL at once.
// On success every session of the account has ended (the API revokes them), so this browser's is
// cleared too, and sign-in says the password changed.
export function ResetPassword({ token: initialToken }: { token?: string }) {
  const router = useRouter();
  const [token] = useState(initialToken);
  const [error, setError] = useState<string>();
  const [confirmError, setConfirmError] = useState<string>();
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    dropTokenFromUrl();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("password_confirmation") ?? "")) {
      setConfirmError("Passwords don't match");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const { error: failed, response } = await apiClient().PATCH("/api/v1/password_reset", { body: { token: token ?? "", password } });
      if (response.ok) {
        // The API has ended that account's sessions. A guest's without an account (their trips)
        // can't be it, so it stays.
        if (!isAnonymous(getSession())) clearSession();
        router.replace(`${LOGIN_PATHS.guest}?${RESET_DONE_FLAG}=1`);
        return;
      }
      setError(message(failed, "Couldn't change your password. Try again."));
    } catch {
      setError("Couldn't change your password. Check your connection and try again.");
    }
    setPending(false);
  }

  return (
    <Card data-testid="reset-password" className="w-full self-start">
      <CardBody pad="lg" className="flex flex-col gap-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Choose a new password</h1>
        {token ? (
          <form method="post" onSubmit={submit}>
            <fieldset disabled={pending} className="flex flex-col gap-3">
              <PasswordField
                label="New password"
                name="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                maxLength={MAX_PASSWORD}
                hint={`${MIN_PASSWORD} to ${MAX_PASSWORD} characters`}
                visible={visible}
                onVisibleChange={setVisible}
                required
              />
              <PasswordField
                label="Confirm password"
                name="password_confirmation"
                autoComplete="new-password"
                maxLength={MAX_PASSWORD}
                error={confirmError}
                visible={visible}
                onVisibleChange={setVisible}
                onChange={() => setConfirmError(undefined)}
                required
              />
              {error && (
                <p role="alert" data-testid="reset-password-error" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" size="sm" className="mt-1">
                {pending ? "Saving…" : "Save new password"}
              </Button>
            </fieldset>
          </form>
        ) : (
          <p role="alert" data-testid="reset-password-error" className="text-sm text-danger">
            This link is missing its code. Open the link from the email again, or ask for a new one.
          </p>
        )}
        <p className="text-small text-muted">
          Link expired?{" "}
          <Link href={FORGOT_PASSWORD_PATHS.guest} className="font-semibold text-link underline">
            Ask for a new one
          </Link>{" "}
          ·{" "}
          <Link href={FORGOT_PASSWORD_PATHS.partner} className="font-semibold text-link underline">
            for a partner account
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
