"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ComboboxField, type ComboboxOption } from "@/components/ui/combobox-field";
import { Field } from "@/components/ui/field";
import { PhoneField } from "@/components/ui/phone-field";
import { useSession } from "@/lib/auth/session";
import { countryName } from "@/lib/countries";
import {
  citiesOf,
  findByName,
  loadPhAddressData,
  provincesOf,
  zipsOf,
  type PhAddressData,
  type Place,
} from "@/lib/ph-address";
import { partnerProfileKey, type PartnerProfile } from "./use-partner-profile";

// Partners are in the Philippines for now: the form takes PH addresses and +63 numbers.
// The API accepts any country, so adding others back is a change here only.
const COUNTRY = "PH";

function formatPhone(phone: string | null) {
  return phone ? (parsePhoneNumberFromString(phone)?.formatInternational() ?? phone) : null;
}

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
          <Item label="Phone" value={formatPhone(profile.phone)} />
          <Item label="Email" value={profile.email} />
        </Section>
        <Section title="Address">
          <Item label="Country" value={address.country && countryName(address.country)} />
          <Item label="Region" value={address.region} />
          {address.province && <Item label="Province" value={address.province} />}
          <Item label="City / Municipality" value={address.city} />
          <Item label="ZIP code" value={address.postal_code} />
          <Item label="Street" value={address.street} />
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

function toOptions(places: Place[]): ComboboxOption[] {
  return places.map((place) => ({ value: place.code, label: place.name }));
}

// The Philippine places behind the address suggestions, loaded when the form opens.
function usePhAddressData() {
  const [data, setData] = useState<PhAddressData>();
  useEffect(() => {
    let current = true;
    void loadPhAddressData().then((loaded) => current && setData(loaded));
    return () => {
      current = false;
    };
  }, []);
  return data;
}

type Body = {
  display_name: string | null;
  legal_first_name: string;
  legal_last_name: string;
  phone: string;
  address: {
    street: string;
    city: string;
    province: string | null;
    region: string;
    postal_code: string;
    country: string;
  };
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
  const { address } = profile;
  const savedPhone = profile.phone ? parsePhoneNumberFromString(profile.phone, COUNTRY) : undefined;

  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [firstName, setFirstName] = useState(profile.legal_first_name ?? "");
  const [lastName, setLastName] = useState(profile.legal_last_name ?? "");
  // A PH number reopens as the part after +63; any other keeps its own + code.
  const [phoneNumber, setPhoneNumber] = useState(
    savedPhone?.country === COUNTRY ? savedPhone.nationalNumber : (profile.phone ?? ""),
  );
  const [phoneError, setPhoneError] = useState<string>();
  const [region, setRegion] = useState(address.region ?? "");
  const [province, setProvince] = useState(address.province ?? "");
  const [city, setCity] = useState(address.city ?? "");
  const [zip, setZip] = useState(address.postal_code ?? "");
  const [street, setStreet] = useState(address.street ?? "");

  // Codes follow from the names, so a saved address reopens with its suggestions narrowed.
  const ph = usePhAddressData();
  const regionPlace = ph && findByName(ph.regions, region);
  const regionCode = regionPlace?.code;
  const provinces = ph ? provincesOf(ph, regionCode) : [];
  const provincePlace = findByName(provinces, province);
  const provinceCode = provincePlace?.code;
  // Metro Manila has no provinces: its cities hang off the region.
  const hasProvinces = !ph || !regionCode || provinces.length > 0;
  const cities = ph && regionCode && (provinceCode || !hasProvinces) ? citiesOf(ph, regionCode, provinceCode) : [];
  const cityCode = findByName(cities, city)?.code;
  const zips = ph ? zipsOf(ph, cityCode) : [];

  function changeRegion(text: string, option?: ComboboxOption) {
    const next = option?.value ?? (ph && findByName(ph.regions, text)?.code);
    setRegion(text);
    if (next !== regionCode) {
      setProvince("");
      setCity("");
      setZip("");
    }
  }

  function changeProvince(text: string, option?: ComboboxOption) {
    const next = option?.value ?? findByName(provinces, text)?.code;
    setProvince(text);
    if (next !== provinceCode) {
      setCity("");
      setZip("");
    }
  }

  function changeCity(text: string, option?: ComboboxOption) {
    const next = option?.value ?? findByName(cities, text)?.code;
    setCity(text);
    if (next === cityCode) return;
    // A city with one ZIP fills it in.
    const cityZips = ph ? zipsOf(ph, next) : [];
    setZip(cityZips.length === 1 ? cityZips[0] : "");
  }

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
    if (!isValidPhoneNumber(phoneNumber, COUNTRY)) {
      setPhoneError("Enter a valid Philippine number, e.g. 917 123 4567");
      return;
    }
    setPhoneError(undefined);
    save.mutate({
      display_name: displayName.trim() || null,
      legal_first_name: firstName.trim(),
      legal_last_name: lastName.trim(),
      phone: parsePhoneNumberFromString(phoneNumber, COUNTRY)!.number,
      address: {
        country: COUNTRY,
        region: region.trim(),
        province: hasProvinces ? province.trim() || null : null,
        city: city.trim(),
        postal_code: zip.trim(),
        street: street.trim(),
      },
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
          hint="Shown to travellers. Leave it blank to use your legal name."
        />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Legal name</legend>
        <Field
          label="First name"
          name="legal_first_name"
          required
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
        <Field
          label="Last name"
          name="legal_last_name"
          required
          autoComplete="family-name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
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

      {/* Six columns so each field is about as wide as what goes in it; one column on phones. */}
      <fieldset className="grid gap-3 sm:grid-cols-6">
        <legend className="mb-3 font-semibold">Address</legend>
        <div className="sm:col-span-2">
          <Field label="Country" name="country" value={`🇵🇭 ${countryName(COUNTRY)}`} disabled readOnly />
        </div>
        <div className="sm:col-span-4">
          <ComboboxField
            label="Region"
            name="region"
            required
            value={region}
            onChange={changeRegion}
            options={ph ? toOptions(ph.regions) : []}
            placeholder="Search regions, e.g. Central Visayas"
          />
        </div>
        {/* Every field always has a placeholder saying what to do next, so an empty field is
            never blank after an earlier pick clears it; placeholders don't move the layout.
            Province is always rendered too, disabled where the region has none. */}
        <div className="sm:col-span-3">
          <ComboboxField
            label="Province"
            name="province"
            required={hasProvinces}
            disabled={!hasProvinces}
            value={hasProvinces ? province : ""}
            onChange={changeProvince}
            options={toOptions(provinces)}
            placeholder={
              !hasProvinces
                ? "None in this region"
                : regionPlace
                  ? `Search provinces in ${regionPlace.name}`
                  : "Pick a region first"
            }
          />
        </div>
        <div className="sm:col-span-3">
          <ComboboxField
            label="City / Municipality"
            name="city"
            required
            value={city}
            onChange={changeCity}
            options={toOptions(cities)}
            placeholder={
              !regionPlace
                ? "Pick a region first"
                : !hasProvinces
                  ? `Search cities in ${regionPlace.name}`
                  : provincePlace
                    ? `Search cities in ${provincePlace.name}`
                    : "Pick a province first"
            }
          />
        </div>
        <div className="sm:col-span-2">
          <ComboboxField
            label="ZIP code"
            name="postal_code"
            required
            inputMode="numeric"
            value={zip}
            onChange={(text) => setZip(text)}
            options={zips.map((code) => ({ value: code, label: code }))}
            placeholder={`e.g. ${zips[0] ?? "6032"}`}
          />
        </div>
        <div className="sm:col-span-4">
          <Field
            label="Street"
            name="street"
            required
            autoComplete="street-address"
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            placeholder="e.g. 12 Rizal St, Poblacion"
            hint="House or building number, street and barangay"
          />
        </div>
        <p className="text-xs text-muted sm:col-span-6">
          Places from the{" "}
          <a className="text-link underline" href="https://psa.gov.ph/classification/psgc" target="_blank" rel="noreferrer">
            PSA&apos;s geographic codes
          </a>
          ; ZIP codes from{" "}
          <a className="text-link underline" href="https://www.geonames.org" target="_blank" rel="noreferrer">
            GeoNames
          </a>{" "}
          (CC BY 4.0).
        </p>
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
