"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { apiClient } from "@/api/client";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { AddressSection, ProfileItem, ProfileSection } from "@/components/profile/profile-view";
import { useNameField } from "@/components/profile/use-name-field";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PhoneField } from "@/components/ui/phone-field";
import { useSession } from "@/lib/auth/session";
import { PHONE_ERROR, editablePhone, formatPhone, toE164 } from "@/lib/ph-phone";
import { partnerProfileKey, type PartnerProfile } from "./use-partner-profile";

// The partner's profile (RAA-40): read-only once complete, with Edit to change it; an
// incomplete profile opens straight in the form. The guest's is its own page
// (components/guest/): the two will grow different fields.
export function ProfileDetails({ profile }: { profile: PartnerProfile }) {
  const [editing, setEditing] = useState(!profile.complete);

  if (editing) {
    return <ProfileForm profile={profile} onDone={() => setEditing(false)} canCancel={profile.complete} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ProfileSection title="Business">
          <ProfileItem label="Display name" value={profile.display_name ?? "Not set: needed before you add a listing"} />
        </ProfileSection>
        <ProfileSection title="Legal name">
          <ProfileItem label="First name" value={profile.legal_first_name} />
          <ProfileItem label="Last name" value={profile.legal_last_name} />
        </ProfileSection>
        <ProfileSection title="Contact">
          <ProfileItem label="Phone" value={formatPhone(profile.phone)} />
          <ProfileItem label="Email" value={profile.email} />
        </ProfileSection>
        <AddressSection address={profile.address} />
      </div>
      <div>
        <Button size="sm" variant="soft" data-testid="profile-edit" onClick={() => setEditing(true)}>
          Edit profile
        </Button>
      </div>
    </div>
  );
}

type Body = {
  display_name: string | null;
  legal_first_name: string;
  legal_last_name: string;
  phone: string;
  address: ReturnType<ReturnType<typeof usePhAddress>["toBody"]>;
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

  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const firstName = useNameField("First name", profile.legal_first_name);
  const lastName = useNameField("Last name", profile.legal_last_name);
  const [phoneNumber, setPhoneNumber] = useState(editablePhone(profile.phone));
  const [phoneError, setPhoneError] = useState<string>();
  const address = usePhAddress(profile.address);

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
    const firstOk = firstName.validate();
    const lastOk = lastName.validate();
    const phone = toE164(phoneNumber);
    setPhoneError(phone ? undefined : PHONE_ERROR);
    if (!firstOk) return firstName.focus();
    if (!lastOk) return lastName.focus();
    if (!phone) return;
    save.mutate({
      display_name: displayName.trim() || null,
      legal_first_name: firstName.value,
      legal_last_name: lastName.value,
      phone,
      address: address.toBody(),
    });
  }

  return (
    <form data-testid="profile-form" onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6">
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
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          hint="Shown to travellers on your listings. Needed before you add one."
        />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Legal name</legend>
        <Field
          label="First name"
          name="legal_first_name"
          required
          autoComplete="given-name"
          {...firstName.props}
          hint="As on your ID"
        />
        <Field
          label="Last name"
          name="legal_last_name"
          required
          autoComplete="family-name"
          {...lastName.props}
          hint="As on your ID"
        />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Contact</legend>
        <PhoneField
          label="Phone"
          required
          number={phoneNumber}
          onNumberChange={(next) => {
            setPhoneNumber(next);
            setPhoneError(undefined);
          }}
          error={phoneError}
          hint="e.g. 917 123 4567"
        />
        <Field label="Email" name="email" type="email" value={profile.email} disabled readOnly hint="Your sign-in email" />
      </fieldset>

      <PhAddressFields address={address} />

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
