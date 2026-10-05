"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { completeProfile, type SelfServeRole } from "@/lib/auth/actions";
import { RoleGuard } from "./role-guard";

// The step after sign-up (RAA-32): sign-up asks only for email and password, so a new
// guest or partner sets a name and phone here before reaching their dashboard. The
// guard sends anyone who's already done it to their dashboard.
export function CompleteProfileCard({ role }: { role: SelfServeRole }) {
  return (
    <RoleGuard role={role} completeProfile>
      <ProfileForm role={role} />
    </RoleGuard>
  );
}

function ProfileForm({ role }: { role: SelfServeRole }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    const result = await completeProfile({
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
    });
    setPending(false);
    // The guard's answer is now out of date; with the new one it moves on to the dashboard.
    if (result.ok) queryClient.setQueryData(["confirm-role", role, result.user.id], result.user);
    else setError(result.error);
  }

  return (
    <Card data-testid={`${role}-complete-profile`} className="w-full self-start">
      <CardBody pad="lg" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-bold italic">Complete your profile</h2>
          <p className="text-sm text-muted">
            {role === "partner"
              ? "Guests and our team will reach you with these."
              : "Partners use these to reach you about your bookings."}
          </p>
        </div>

        <form onSubmit={submit}>
          <fieldset disabled={pending} className="flex flex-col gap-3">
            <Field label="Full name" name="name" type="text" autoComplete="name" required />
            <Field
              label="Phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+63 917 123 4567"
              required
            />
            {error && (
              <p role="alert" data-testid="auth-error" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="sm" className="mt-1">
              {pending ? "Please wait…" : "Continue"}
            </Button>
          </fieldset>
        </form>
      </CardBody>
    </Card>
  );
}
