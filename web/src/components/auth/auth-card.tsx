"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { oauthSignIn, signIn, signUp, type OauthProvider, type Role } from "@/lib/auth/actions";
import { DASHBOARD_PATHS, LOGIN_PATHS, REGISTER_PATHS } from "@/lib/auth/paths";
import { useSession } from "@/lib/auth/session";
import { OauthButtons, hasOauthProviders } from "./oauth-buttons";

type Mode = "signin" | "signup";

const TITLES: Record<Role, Record<Mode, string>> = {
  guest: { signin: "Welcome back", signup: "Create a guest account" },
  partner: { signin: "Partner sign in", signup: "Become a partner" },
  admin: { signin: "Sign in", signup: "Sign in" },
};

type Props = {
  // The entry point: a guest form makes guests, a partner form partners. Admin is
  // sign-in only: no sign-up, no Google/Facebook, no password reset. Signing in lands
  // on the role's dashboard.
  role: Role;
  // Set by the route: /login and /partner/login sign in, /register and
  // /partner/register sign up. Admin is always "signin".
  mode: Mode;
};

export function AuthCard({ role, mode }: Props) {
  const router = useRouter();
  const redirectTo = DASHBOARD_PATHS[role];
  const selfServe = role !== "admin";
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string>();
  // Sign-up's two password fields show and hide together, so they can be compared.
  const [showPasswords, setShowPasswords] = useState(false);
  const signup = selfServe && mode === "signup";

  // Already signed in with this role (back button, a second tab): skip the form.
  const session = useSession();
  const signedInHere = session?.user.role === role;
  useEffect(() => {
    if (signedInHere) router.replace(redirectTo);
  }, [signedInHere, redirectTo, router]);

  async function run(action: () => ReturnType<typeof signIn>) {
    setPending(true);
    setError(undefined);
    const result = await action();
    setPending(false);
    if (result.ok) router.replace(redirectTo);
    else setError(result.error);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");
    const email = value("email");
    const password = value("password");

    if (signup) {
      // A typing check only; the API takes one password.
      if (password !== value("password_confirmation")) {
        setConfirmError("Passwords don't match");
        return;
      }
      const phone = value("phone");
      void run(() =>
        signUp({ email, password, name: value("name"), phone: phone || undefined, role }),
      );
    } else {
      void run(() => signIn({ email, password, role }));
    }
  }

  function onOauthToken(provider: OauthProvider, token: string) {
    if (role === "admin") return;
    void run(() => oauthSignIn(provider, token, role));
  }

  // Shown while the redirect happens, and for good where the form's page is the
  // destination (/admin).
  if (signedInHere) {
    return (
      <Card data-testid={`${role}-signed-in`} className="w-full self-start">
        <CardBody pad="lg">
          <p className="text-sm text-muted">Signed in as {session.user.name}.</p>
        </CardBody>
      </Card>
    );
  }

  // Password reset isn't built yet: the link is there so the layout is final.
  const forgotPassword = selfServe && !signup && (
    <button type="button" className="text-xs font-medium text-link hover:underline">
      Forgot password?
    </button>
  );

  return (
    <Card data-testid={`${role}-${signup ? "signup" : "signin"}`} className="w-full self-start">
      <CardBody pad="lg" className="flex flex-col gap-5">
        <h2 className="font-display text-2xl font-bold italic">{TITLES[role][signup ? "signup" : "signin"]}</h2>

        {selfServe && hasOauthProviders() && (
          <div className="flex flex-col gap-4">
            <OauthButtons disabled={pending} onToken={onOauthToken} />
            <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              or continue with email
              <span className="h-px flex-1 bg-line" />
            </div>
          </div>
        )}

        <form onSubmit={submit}>
          <fieldset disabled={pending} className="flex flex-col gap-3">
            {signup && <Field label="Full name" name="name" type="text" autoComplete="name" required />}
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            {signup && <Field label="Phone" name="phone" type="tel" autoComplete="tel" hint="Optional" />}
            <PasswordField
              label="Password"
              name="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={signup ? 8 : undefined}
              hint={signup ? "At least 8 characters" : undefined}
              action={forgotPassword}
              visible={signup ? showPasswords : undefined}
              onVisibleChange={signup ? setShowPasswords : undefined}
              required
            />
            {signup && (
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
            )}
            {error && (
              <p role="alert" data-testid="auth-error" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="sm" className="mt-1">
              {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
            </Button>
          </fieldset>
        </form>

        {role !== "admin" && (
          <p className="text-center text-sm text-muted">
            {signup ? "Already have an account? " : "Don't have an account? "}
            <Link
              href={signup ? LOGIN_PATHS[role] : REGISTER_PATHS[role]}
              className="font-semibold text-link hover:underline"
            >
              {signup ? "Sign in" : "Create one"}
            </Link>
          </p>
        )}
      </CardBody>
    </Card>
  );
}
