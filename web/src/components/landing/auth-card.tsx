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
    <section
      data-testid={`${audience}-${mode}`}
      className="w-full rounded-xl border border-line bg-surface p-5"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <form className="mt-4">
        <fieldset disabled className="flex flex-col gap-3">
          {signup && <Field label="Full name" name="name" type="text" />}
          <Field label="Email" name="email" type="email" />
          {signup && <Field label="Phone" name="phone" type="tel" />}
          <Field label="Password" name="password" type="password" />
          <button
            type="submit"
            className="mt-1 rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
          >
            {signup ? "Create account" : "Sign in"}
          </button>
        </fieldset>
      </form>
      <p className="mt-3 text-xs text-muted">Accounts open soon.</p>
    </section>
  );
}

function Field({ label, name, type }: { label: string; name: string; type: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        name={name}
        type={type}
        className="rounded-lg border border-line bg-background px-3 py-2 disabled:bg-sky-tint"
      />
    </label>
  );
}
