"use client";

import { useEffect, useState } from "react";
import type { components } from "@/api/schema";
import { ComboboxField, type ComboboxOption } from "@/components/ui/combobox-field";
import { Field } from "@/components/ui/field";
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

// A Philippine address, from region down to street, each field suggesting places inside
// the one above (RAA-40). Shared by the guest's and the partner's profile forms: each
// form keeps the state with usePhAddress and sends address.toBody().

type SavedAddress = components["schemas"]["profile_address"];
export type PhAddress = ReturnType<typeof usePhAddress>;

// Partners and guests are in the Philippines for now. The API accepts any country, so
// adding others back is a change here only.
const COUNTRY = "PH";

function toOptions(places: Place[]): ComboboxOption[] {
  return places.map((place) => ({ value: place.code, label: place.name }));
}

// The places behind the suggestions, loaded when the form opens.
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

export function usePhAddress(saved: SavedAddress) {
  const [region, setRegion] = useState(saved.region ?? "");
  const [province, setProvince] = useState(saved.province ?? "");
  const [city, setCity] = useState(saved.city ?? "");
  const [zip, setZip] = useState(saved.postal_code ?? "");
  const [street, setStreet] = useState(saved.street ?? "");

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

  // Changing a field clears the ones below it.
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

  return {
    values: { region, province, city, zip, street },
    ph,
    regionPlace,
    provinces,
    provincePlace,
    hasProvinces,
    cities,
    zips,
    changeRegion,
    changeProvince,
    changeCity,
    setZip,
    setStreet,
    toBody: () => ({
      country: COUNTRY,
      region: region.trim(),
      province: hasProvinces ? province.trim() || null : null,
      city: city.trim(),
      postal_code: zip.trim(),
      street: street.trim(),
    }),
  };
}

export function PhAddressFields({ address }: { address: PhAddress }) {
  const { values, ph, regionPlace, provinces, provincePlace, hasProvinces, cities, zips } = address;

  return (
    // Six columns so each field is about as wide as what goes in it; one column on phones.
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
          value={values.region}
          onChange={address.changeRegion}
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
          value={hasProvinces ? values.province : ""}
          onChange={address.changeProvince}
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
          value={values.city}
          onChange={address.changeCity}
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
          value={values.zip}
          onChange={(text) => address.setZip(text)}
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
          value={values.street}
          onChange={(event) => address.setStreet(event.target.value)}
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
  );
}
