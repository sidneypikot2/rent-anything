"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY, countryName } from "@/lib/countries";
import { useSession } from "@/lib/auth/session";
import { partnerProfileKey, type PartnerProfile } from "./use-partner-profile";

// The partner's profile (RAA-40): read-only once complete, with Edit to change it; an
// incomplete profile opens straight in the form.
export function ProfileDetails({ profile }: { profile: PartnerProfile }) {
  const [editing, setEditing] = useState(!profile.complete);

  if (editing) {
    return <ProfileForm profile={profile} onDone={() => setEditing(false)} canCancel={profile.complete} />;
  }

  const { address } = profile;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="Business">
          <Item label="Display name" value={profile.display_name ?? "Not set: your legal name is shown"} />
        </Section>
        <Section title="Legal name">
          <Item label="First name" value={profile.legal_first_name} />
          <Item label="Last name" value={profile.legal_last_name} />
        </Section>
        <Section title="Contact">
          <Item label="Phone" value={profile.phone} />
          <Item label="Email" value={profile.email} />
        </Section>
        <Section title="Address">
          <Item label="Street" value={address.street} />
          <Item label="City" value={address.city} />
          <Item label="Region / Province" value={address.region} />
          <Item label="ZIP code" value={address.postal_code} />
          <Item label="Country" value={address.country && countryName(address.country)} />
        </Section>
      </div>
      <div>
        <Button size="sm" variant="soft" data-testid="profile-edit" onClick={() => setEditing(true)}>
          Edit profile
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold">{title}</h2>
        <dl className="flex flex-col gap-2">{children}</dl>
      </CardBody>
    </Card>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

type Body = {
  display_name: string | null;
  legal_first_name: string;
  legal_last_name: string;
  phone: string;
  address: { street: string; city: string; region: string; postal_code: string; country: string };
};

function ProfileForm({
  profile,
  onDone,
  canCancel,
}: {
  profile: PartnerProfile;
  onDone: () => void;
  canCancel: boolean;
}) {
  const queryClient = useQueryClient();
  const session = useSession();
  const save = useMutation({
    mutationFn: async (body: Body) => {
      const { data, error } = await apiClient().PUT("/api/v1/partner/profile", { body });
      if (data) return data;
      const message =
        (error && "errors" in error && error.errors?.join(". ")) || "Couldn't save your profile. Try again.";
      throw new Error(message);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(partnerProfileKey(session?.user.id), data);
      onDone();
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    save.mutate({
      display_name: value("display_name") || null,
      legal_first_name: value("legal_first_name"),
      legal_last_name: value("legal_last_name"),
      phone: value("phone"),
      address: {
        street: value("street"),
        city: value("city"),
        region: value("region"),
        postal_code: value("postal_code"),
        country: value("country"),
      },
    });
  }

  const { address } = profile;
  return (
    <form data-testid="profile-form" onSubmit={onSubmit} className="flex flex-col gap-6">
      {save.error && (
        <p role="alert" className="text-sm text-danger">
          {save.error.message}
        </p>
      )}

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Business</legend>
        <Field
          label="Display name"
          name="display_name"
          defaultValue={profile.display_name ?? ""}
          hint="Shown to travellers. Leave it blank to use your legal name."
        />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Legal name</legend>
        <Field label="First name" name="legal_first_name" required autoComplete="given-name" defaultValue={profile.legal_first_name ?? ""} />
        <Field label="Last name" name="legal_last_name" required autoComplete="family-name" defaultValue={profile.legal_last_name ?? ""} />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Contact</legend>
        <Field
          label="Phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          defaultValue={profile.phone ?? ""}
          hint="With country code, e.g. +63 917 123 4567"
        />
        <Field label="Email" name="email" type="email" value={profile.email} disabled readOnly hint="Your sign-in email" />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Address</legend>
        <div className="sm:col-span-2">
          <Field label="Street" name="street" required autoComplete="street-address" defaultValue={address.street ?? ""} />
        </div>
        <Field label="City" name="city" required autoComplete="address-level2" defaultValue={address.city ?? ""} />
        <Field label="Region / Province" name="region" required autoComplete="address-level1" defaultValue={address.region ?? ""} />
        <Field label="ZIP code" name="postal_code" required autoComplete="postal-code" defaultValue={address.postal_code ?? ""} />
        <SelectField
          label="Country"
          name="country"
          required
          autoComplete="country"
          options={COUNTRY_OPTIONS}
          defaultValue={address.country ?? DEFAULT_COUNTRY}
        />
      </fieldset>

      <div className="flex gap-2">
        <Button size="sm" type="submit" data-testid="profile-save" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
        {canCancel && (
          <Button size="sm" variant="soft" type="button" data-testid="profile-cancel" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
