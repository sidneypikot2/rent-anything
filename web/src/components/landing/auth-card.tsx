import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import type { Section } from "./section-header";

type Props = {
  mode: "signup" | "signin";
  audience: Section;
  title: string;
};

// A sign-up or sign-in form shown before accounts exist (M1). The fieldset is disabled:
// nothing submits yet. When auth lands, a sign-up from / creates a guest and one from
// /partner creates a partner; /admin only ever signs in.
export function AuthCard({ mode, audience, title }: Props) {
  const signup = mode === "signup";

  return (
    <Card data-testid={`${audience}-${mode}`} className="w-full self-start">
      <CardBody className="p-5">
        <h2 className="font-display text-2xl font-bold italic">{title}</h2>
        <form className="mt-4">
          <fieldset disabled className="flex flex-col gap-3">
            {signup && <Field label="Full name" name="name" type="text" />}
            <Field label="Email" name="email" type="email" />
            {signup && <Field label="Phone" name="phone" type="tel" />}
            <Field label="Password" name="password" type="password" />
            <Button type="submit" size="sm" className="mt-1">
              {signup ? "Create account" : "Sign in"}
            </Button>
          </fieldset>
        </form>
        <p className="mt-3 text-xs text-muted">Accounts open soon.</p>
      </CardBody>
    </Card>
  );
}
