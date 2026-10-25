"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EmailCodeForm } from "@/components/auth/email-code-form";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { unlockTripLink } from "@/lib/auth/actions";

// A trip link's page (RAA-177): it asks for the PIN on every open and never remembers it. The
// session it opens lasts this tab (sessionStorage), so the next open asks again; within it
// the cart works as usual, edits, requests and payment included. Five wrong PINs lock the
// link; "Forgot PIN or locked?" signs in with an emailed code instead, for this tab too, and
// the guest then resets the link and PIN from the cart. `next` is where to go once open.
export function TripLinkUnlock({ token, next = "/cart" }: { token: string; next?: string }) {
  const router = useRouter();
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string>();
  const [locked, setLocked] = useState(false);
  const [pending, setPending] = useState(false);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pin = String(new FormData(event.currentTarget).get("pin") ?? "").trim();
    setPending(true);
    setError(undefined);
    const result = await unlockTripLink(token, pin);
    if (result.ok) return router.replace(next);
    setPending(false);
    setLocked(result.locked);
    setError(result.error);
  }

  return (
    <Card data-testid="trip-link-unlock" className="w-full self-start">
      <CardBody pad="lg" className="flex flex-col gap-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          {recovering ? "Get a code by email" : "Open your trips"}
        </h1>

        {recovering ? (
          <EmailCodeForm tabOnly onSignedIn={() => router.replace(next)} />
        ) : locked ? (
          <div className="flex flex-col gap-3" data-testid="trip-link-locked">
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
            <p className="text-sm text-muted">
              To keep your trips safe, this link is locked after five wrong PINs. Sign in with a code sent to your email,
              then make a new link and PIN from your cart.
            </p>
            <Button type="button" size="sm" onClick={() => setRecovering(true)}>
              Email me a code
            </Button>
          </div>
        ) : (
          <form onSubmit={unlock}>
            <fieldset disabled={pending} className="flex flex-col gap-3">
              <p className="text-sm text-muted">Enter the 6-digit PIN that came with this link.</p>
              <Field
                label="PIN"
                name="pin"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
              {error && (
                <p role="alert" data-testid="trip-link-error" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" size="sm" data-testid="trip-link-open">
                {pending ? "Opening…" : "Open"}
              </Button>
            </fieldset>
          </form>
        )}

        <div className="flex flex-col gap-2 text-sm">
          {recovering ? (
            <button type="button" onClick={() => setRecovering(false)} className="self-start font-semibold text-link hover:underline">
              Back to the PIN
            </button>
          ) : (
            !locked && (
              <button
                type="button"
                data-testid="trip-link-forgot"
                onClick={() => setRecovering(true)}
                className="self-start font-semibold text-link hover:underline"
              >
                Forgot PIN or locked?
              </button>
            )
          )}
          <Link href="/trips/keep" className="self-start font-semibold text-link hover:underline">
            Create an account to keep this trip
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
