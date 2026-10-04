"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { oauthSignIn, signIn, signUp, type OauthProvider, type Role } from "@/lib/auth/actions";
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
  // sign-in only, with no sign-up and no Google/Facebook.
  role: Role;
  redirectTo: string;
  initialMode?: Mode;
};

export function AuthCard({ role, redirectTo, initialMode = "signin" }: Props) {
  const router = useRouter();
  const selfServe = role !== "admin";
  const [mode, setMode] = useState<Mode>(selfServe ? initialMode : "signin");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const signup = mode === "signup";

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
    if (result.ok) {
      router.replace(redirectTo);
    } else {
      setError(result.error);
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");
    const email = value("email");
    const password = value("password");

    if (signup && role !== "admin") {
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

  return (
    <Card data-testid={`${role}-${mode}`} className="w-full self-start">
      <CardBody pad="lg" className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold italic">{TITLES[role][mode]}</h2>

        {selfServe && (
          <div className="flex gap-2" role="group" aria-label="Sign in or create an account">
            <Pill on={!signup} onClick={() => setMode("signin")}>
              Sign in
            </Pill>
            <Pill on={signup} onClick={() => setMode("signup")}>
              Create account
            </Pill>
          </div>
        )}

        <form onSubmit={submit}>
          <fieldset disabled={pending} className="flex flex-col gap-3">
            {signup && <Field label="Full name" name="name" type="text" autoComplete="name" required />}
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            {signup && <Field label="Phone" name="phone" type="tel" autoComplete="tel" hint="Optional" />}
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={signup ? 8 : undefined}
              hint={signup ? "At least 8 characters" : undefined}
              required
            />
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
          <>
            <p className="text-center text-xs text-muted">or</p>
            <OauthButtons disabled={pending} onToken={onOauthToken} />
          </>
        )}
      </CardBody>
    </Card>
  );
}
