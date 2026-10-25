"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiClient } from "@/api/client";
import { EmailCodeForm } from "@/components/auth/email-code-form";
import { tripError } from "@/components/trips/use-trips";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PasswordField } from "@/components/ui/password-field";
import { LOGIN_PATHS } from "@/lib/auth/paths";
import { isAnonymous, saveSessionUser, useSession } from "@/lib/auth/session";

// "Create an account to keep this trip" (RAA-177), where the trip-link and reminder emails
// lead: a guest without an account sets a password (POST /me/register), and their trips are
// no longer deleted 60 days after they end. Signed out, they sign in with an emailed code
// first (or open their trip link with the PIN, which links here).
export function KeepTrips() {
  const session = useSession();
  const [showPasswords, setShowPasswords] = useState(false);
  const [confirmError, setConfirmError] = useState<string>();
  const register = useMutation({
    mutationFn: async (password: string) => {
      const { data, error } = await apiClient().POST("/api/v1/me/register", { body: { password } });
      if (!data) throw tripError(error, "Couldn't create your account. Try again.");
      return data;
    },
    onSuccess: saveSessionUser,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("password_confirmation") ?? "")) return setConfirmError("Passwords don't match");
    register.mutate(password);
  }

  const user = session?.user;
  let body;
  if (session === undefined) {
    body = <p className="text-sm text-muted">Checking your account…</p>;
  } else if (!user || user.role !== "guest" || isAnonymous(session)) {
    body = (
      <>
        <p className="text-sm text-muted">
          First, show it&apos;s you: open your trip link and enter your PIN, or get a code sent to the email you booked
          with.
        </p>
        <EmailCodeForm onSignedIn={() => undefined} />
      </>
    );
  } else if (user.registered) {
    body = (
      <div className="flex flex-col items-start gap-3" data-testid="keep-trips-done">
        <p className="text-sm">
          Your trips are kept. You can now sign in with <span className="font-semibold">{user.email}</span> and your
          password.
        </p>
        <ButtonLink href="/cart" size="sm">
          Go to your trips
        </ButtonLink>
      </div>
    );
  } else {
    body = (
      <form onSubmit={submit} data-testid="keep-trips-form">
        <fieldset disabled={register.isPending} className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Without an account, a trip is deleted 60 days after it ends. Set a password for{" "}
            <span className="font-semibold text-foreground">{user.email}</span> and we&apos;ll keep your trips.
          </p>
          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters"
            visible={showPasswords}
            onVisibleChange={setShowPasswords}
            required
          />
          <PasswordField
            label="Confirm password"
            name="password_confirmation"
            autoComplete="new-password"
            error={confirmError}
            visible={showPasswords}
            onVisibleChange={setShowPasswords}
            onChange={() => setConfirmError(undefined)}
            required
          />
          {register.error && (
            <p role="alert" className="text-sm text-danger">
              {register.error.message}
            </p>
          )}
          <Button type="submit" size="sm" data-testid="keep-trips-submit">
            {register.isPending ? "Please wait…" : "Create account"}
          </Button>
        </fieldset>
      </form>
    );
  }

  return (
    <Card data-testid="keep-trips" className="w-full self-start">
      <CardBody pad="lg" className="flex flex-col gap-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Create an account to keep your trips</h1>
        {body}
        {!user?.registered && (
          <p className="text-sm text-muted">
            Already have a password?{" "}
            <Link href={LOGIN_PATHS.guest} className="font-semibold text-link hover:underline">
              Sign in
            </Link>
          </p>
        )}
      </CardBody>
    </Card>
  );
}
