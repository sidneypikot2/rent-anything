"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ComboboxField, type ComboboxOption } from "@/components/ui/combobox-field";
import { Field } from "@/components/ui/field";
import { PhoneField } from "@/components/ui/phone-field";
import { SelectField } from "@/components/ui/select-field";
import { useSession } from "@/lib/auth/session";
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY, countryName } from "@/lib/countries";
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

// Philippine suggestions, loaded the first time the address country is the Philippines.
function usePhAddressData(country: string) {
  const [data, setData] = useState<PhAddressData>();
  useEffect(() => {
    if (country !== "PH" || data) return;
    let current = true;
    void loadPhAddressData().then((loaded) => current && setData(loaded));
    return () => {
      current = false;
    };
  }, [country, data]);
  return country === "PH" ? data : undefined;
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
  const savedPhone = profile.phone ? parsePhoneNumberFromString(profile.phone) : undefined;

  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [firstName, setFirstName] = useState(profile.legal_first_name ?? "");
  const [lastName, setLastName] = useState(profile.legal_last_name ?? "");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(savedPhone?.country ?? (DEFAULT_COUNTRY as CountryCode));
  const [phoneNumber, setPhoneNumber] = useState(savedPhone ? savedPhone.formatNational() : (profile.phone ?? ""));
  const [phoneError, setPhoneError] = useState<string>();
  const [country, setCountry] = useState(address.country ?? DEFAULT_COUNTRY);
  const [region, setRegion] = useState(address.region ?? "");
  const [province, setProvince] = useState(address.province ?? "");
  const [city, setCity] = useState(address.city ?? "");
  const [zip, setZip] = useState(address.postal_code ?? "");
  const [street, setStreet] = useState(address.street ?? "");

  // Codes follow from the names, so a saved address reopens with its suggestions narrowed.
  const ph = usePhAddressData(country);
  const regionCode = ph && findByName(ph.regions, region)?.code;
  const provinces = ph ? provincesOf(ph, regionCode) : [];
  const provinceCode = findByName(provinces, province)?.code;
  // Metro Manila has no provinces: its cities hang off the region.
  const hasProvinces = !ph || !regionCode || provinces.length > 0;
  const cities = ph && regionCode && (provinceCode || !hasProvinces) ? citiesOf(ph, regionCode, provinceCode) : [];
  const cityCode = findByName(cities, city)?.code;
  const zips = ph ? zipsOf(ph, cityCode) : [];

  function changeCountry(next: string) {
    setCountry(next);
    setRegion("");
    setProvince("");
    setCity("");
    setZip("");
    // The phone's dial code follows the address until a number is typed.
    if (!phoneNumber.trim()) setPhoneCountry(next as CountryCode);
  }

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
    if (!isValidPhoneNumber(phoneNumber, phoneCountry)) {
      setPhoneError("Enter a valid phone number for the country code you picked");
      return;
    }
    setPhoneError(undefined);
    save.mutate({
      display_name: displayName.trim() || null,
      legal_first_name: firstName.trim(),
      legal_last_name: lastName.trim(),
      phone: parsePhoneNumberFromString(phoneNumber, phoneCountry)!.number,
      address: {
        country,
        region: region.trim(),
        province: hasProvinces ? province.trim() || null : null,
        city: city.trim(),
        postal_code: zip.trim(),
        street: street.trim(),
      },
    });
  }

  const inPhilippines = country === "PH";
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
          country={phoneCountry}
          number={phoneNumber}
          onCountryChange={setPhoneCountry}
          onNumberChange={(next) => {
            setPhoneNumber(next);
            setPhoneError(undefined);
          }}
          error={phoneError}
          hint="Pick the country code, then the number, e.g. 917 123 4567"
        />
        <Field label="Email" name="email" type="email" value={profile.email} disabled readOnly hint="Your sign-in email" />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Address</legend>
        <SelectField
          label="Country"
          name="country"
          required
          autoComplete="country"
          options={COUNTRY_OPTIONS}
          value={country}
          onChange={(event) => changeCountry(event.target.value)}
        />
        <ComboboxField
          label="Region / State"
          name="region"
          required
          value={region}
          onChange={changeRegion}
          options={ph ? toOptions(ph.regions) : []}
        />
        {/* Always rendered, so nothing after it moves: disabled where the region has no
            provinces. Guidance goes in placeholders, which don't change the layout. */}
        <ComboboxField
          label="Province / County"
          name="province"
          required={inPhilippines && hasProvinces}
          disabled={!hasProvinces}
          value={hasProvinces ? province : ""}
          onChange={changeProvince}
          options={toOptions(provinces)}
          placeholder={!hasProvinces ? "None in this region" : inPhilippines && !regionCode ? "Pick a region first" : undefined}
        />
        <ComboboxField
          label="City / Municipality"
          name="city"
          required
          value={city}
          onChange={changeCity}
          options={toOptions(cities)}
          placeholder={
            inPhilippines && !regionCode
              ? "Pick a region first"
              : inPhilippines && hasProvinces && !provinceCode
                ? "Pick a province first"
                : undefined
          }
        />
        <ComboboxField
          label="ZIP / Postal code"
          name="postal_code"
          required
          value={zip}
          onChange={(text) => setZip(text)}
          options={zips.map((code) => ({ value: code, label: code }))}
        />
        <div className="sm:col-span-2">
          <Field
            label="Street"
            name="street"
            required
            autoComplete="street-address"
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            hint="House or building number, street and barangay"
          />
        </div>
        <p className="text-xs text-muted sm:col-span-2">
          Philippine places from the{" "}
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
