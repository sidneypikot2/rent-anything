"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { requestSignInCode, verifySignInCode } from "@/lib/auth/actions";

// Signing a guest in with an emailed one-time code (RAA-177): for a lost trip link, a
// forgotten PIN or a locked link, and from /login. First the email, then the 6-digit code.
// The API answers the same whether or not the email has an account, so this says "if".
// tabOnly: the session lasts this tab, as a trip link's does.
export function EmailCodeForm({ onSignedIn, tabOnly }: { onSignedIn: () => void; tabOnly?: boolean }) {
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setPending(true);
    setError(undefined);
    const result = await requestSignInCode(typed);
    setPending(false);
    if (result.ok) setEmail(typed);
    else setError(result.error);
  }

  if (email === null) {
    return (
      <form onSubmit={sendCode} data-testid="email-code-request">
        <fieldset disabled={pending} className="flex flex-col gap-3">
          <Field label="Email" name="email" type="email" autoComplete="email" hint="The one you booked with" required />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="sm">
            {pending ? "Sending…" : "Email me a code"}
          </Button>
        </fieldset>
      </form>
    );
  }

  return (
    <CodeForm
      email={email}
      intro={`If ${email} has trips with us, we've sent it a 6-digit code. It works for 10 minutes.`}
      onSignedIn={onSignedIn}
      onBack={() => setEmail(null)}
      tabOnly={tabOnly}
    />
  );
}

// The 6-digit code sent to `email`, which signs the guest in. Also checkout's step when the
// email given is already in use.
export function CodeForm({
  email,
  intro,
  onSignedIn,
  onBack,
  tabOnly,
}: {
  email: string;
  intro: string;
  onSignedIn: () => void;
  onBack?: () => void;
  tabOnly?: boolean;
}) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    setPending(true);
    setError(undefined);
    const result = await verifySignInCode(email, code, { tabOnly });
    setPending(false);
    if (result.ok) onSignedIn();
    else setError(result.error);
  }

  return (
    <form onSubmit={verify} data-testid="email-code-verify">
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <p className="text-sm text-muted">{intro}</p>
        <Field
          label="Code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
        />
        {error && (
          <p role="alert" data-testid="email-code-error" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="sm">
          {pending ? "Checking…" : "Continue"}
        </Button>
        {onBack && (
          <button type="button" onClick={onBack} className="self-start text-sm font-semibold text-link hover:underline">
            Use another email
          </button>
        )}
      </fieldset>
    </form>
  );
}
