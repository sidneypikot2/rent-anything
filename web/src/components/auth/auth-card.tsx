"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { oauthSignIn, signIn, signUp, type OauthProvider, type Role } from "@/lib/auth/actions";
import { DASHBOARD_PATHS } from "@/lib/auth/paths";
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
};

// A link-styled button for switching views inside the card.
function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="font-semibold text-link hover:underline">
      {children}
    </button>
  );
}

export function AuthCard({ role }: Props) {
  const router = useRouter();
  const redirectTo = DASHBOARD_PATHS[role];
  const selfServe = role !== "admin";
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string>();
  // Sign-up's two password fields show and hide together, so they can be compared.
  const [showPasswords, setShowPasswords] = useState(false);
  const signup = mode === "signup";

  // Already signed in with this role (back button, a second tab): skip the form.
  const session = useSession();
  const signedInHere = session?.user.role === role;
  useEffect(() => {
    if (signedInHere) router.replace(redirectTo);
  }, [signedInHere, redirectTo, router]);

  function switchTo(next: Mode) {
    setMode(next);
    setError(undefined);
    setConfirmError(undefined);
    setShowPasswords(false);
  }

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

    if (signup && role !== "admin") {
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
    <Card data-testid={`${role}-${mode}`} className="w-full self-start">
      <CardBody pad="lg" className="flex flex-col gap-5">
        <h2 className="font-display text-2xl font-bold italic">{TITLES[role][mode]}</h2>

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

        {selfServe && (
          <p className="text-center text-sm text-muted">
            {signup ? (
              <>
                Already have an account? <TextButton onClick={() => switchTo("signin")}>Sign in</TextButton>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <TextButton onClick={() => switchTo("signup")}>Create one</TextButton>
              </>
            )}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
