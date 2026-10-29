"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { oauthSignIn, signIn, signUp, type OauthProvider, type Role } from "@/lib/auth/actions";
import { DASHBOARD_PATHS, LOGIN_PATHS, REGISTER_PATHS, withNext } from "@/lib/auth/paths";
import { isAnonymous, useSession } from "@/lib/auth/session";
import { ConsentField, ConsentNote } from "@/components/legal/consent-field";
import { OauthButtons, hasOauthProviders, oauthProviderNames } from "./oauth-buttons";

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
  // Where to land instead of the dashboard, already checked with safeNextPath. The link to
  // the other form carries it too.
  next?: string;
  // Set when the card sits in a sheet over the page (add to trip): signing in calls it
  // instead of navigating, and the page carries on where it was.
  onSignedIn?: () => void;
  // Set by a card that isn't a page's whole form (the add-to-trip sheet, which leads with
  // creating an account): its own title in place of "Welcome back", and no link to the other form.
  title?: string;
  switchLink?: boolean;
  // h1 on a page with no banner of its own (the guest's /login and /register); the partner and
  // admin pages already have their h1 in a banner.
  headingLevel?: "h1" | "h2";
};

export function AuthCard({ role, mode, next, onSignedIn, title, switchLink = true, headingLevel = "h2" }: Props) {
  const Heading = headingLevel;
  const router = useRouter();
  const redirectTo = next ?? DASHBOARD_PATHS[role];
  const selfServe = role !== "admin";
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string>();
  // Sign-up's two password fields show and hide together, so they can be compared.
  const [showPasswords, setShowPasswords] = useState(false);
  const signup = selfServe && mode === "signup";
  // Sign-up needs the Terms and Privacy policy agreed to, for the form and for Google or
  // Facebook alike, which would otherwise make the account without it.
  const [agreed, setAgreed] = useState(false);

  // Already signed in with this role (back button, a second tab): skip the form. A guest with
  // no account yet (RAA-177) is signed out here.
  const session = useSession();
  const signedInHere = session?.user.role === role && !isAnonymous(session);
  useEffect(() => {
    if (signedInHere && !onSignedIn) router.replace(redirectTo);
  }, [signedInHere, onSignedIn, redirectTo, router]);

  async function run(action: () => ReturnType<typeof signIn>) {
    setPending(true);
    setError(undefined);
    const result = await action();
    setPending(false);
    if (!result.ok) setError(result.error);
    else if (onSignedIn) onSignedIn();
    else router.replace(redirectTo);
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
      void run(() => signUp({ email, password, role }));
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
          <p className="text-sm text-muted">Signed in as {session.user.name ?? session.user.email}.</p>
        </CardBody>
      </Card>
    );
  }

  // Password reset isn't built yet; a guest's emailed code signs them in without one (RAA-177).
  // A partner has no code, so they see nothing rather than a link that goes nowhere.
  const forgotPassword = role === "guest" && !signup && (
    <Link href={withNext("/login/code", next)} className="tap-target text-xs font-medium text-link hover:underline">
      Forgot password?
    </Link>
  );

  return (
    <Card data-testid={`${role}-${signup ? "signup" : "signin"}`} className="w-full self-start">
      <CardBody pad="lg" className="flex flex-col gap-5">
        <Heading className={cn("font-display font-extrabold tracking-tight", title ? "text-lg" : "text-2xl")}>{title ?? TITLES[role][signup ? "signup" : "signin"]}</Heading>

        <form onSubmit={submit}>
          <fieldset disabled={pending} className="flex flex-col gap-3">
            <Field label="Email" name="email" type="email" autoComplete="email" required />
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
            {signup && <ConsentField partner={role === "partner"} checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />}
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

        {selfServe && hasOauthProviders() && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
            <OauthButtons disabled={pending || (signup && !agreed)} onToken={onOauthToken} />
            {signup && !agreed && (
              <p className="text-center text-xs text-muted" data-testid="consent-oauth-hint">
                To sign up with {oauthProviderNames()}, first tick &ldquo;I agree to the {role === "partner" ? "Terms, the Partner terms" : "Terms"} and
                the Privacy policy&rdquo; above.
              </p>
            )}
            {!signup && <ConsentNote partner={role === "partner"} />}
          </div>
        )}

        {role === "guest" && !signup && (
          <p className="text-center text-sm text-pretty text-muted">
            No password?{" "}
            <Link href={withNext("/login/code", next)} data-testid="guest-code-link" className="tap-target font-semibold text-link hover:underline">
              Email me a code
            </Link>
          </p>
        )}

        {role !== "admin" && switchLink && (
          <p className="text-center text-sm text-muted">
            {signup ? "Already have an account? " : "Don't have an account? "}
            <Link
              href={withNext(signup ? LOGIN_PATHS[role] : REGISTER_PATHS[role], next)}
              className="tap-target font-semibold text-link hover:underline"
            >
              {signup ? "Sign in" : "Create one"}
            </Link>
          </p>
        )}
      </CardBody>
    </Card>
  );
}
