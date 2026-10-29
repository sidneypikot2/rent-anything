"use client";

import { useEffect, useState } from "react";
import type { components } from "@/api/schema";
import { ComboboxField, type ComboboxOption } from "@/components/ui/combobox-field";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { COUNTRIES, countryFlag, countryName } from "@/lib/countries";
import type { ReversePlace } from "@/lib/map";
import {
  citiesOf,
  findByName,
  loadPhAddressData,
  matchPlaces,
  provincesOf,
  zipsOf,
  type PhAddressData,
  type Place,
} from "@/lib/ph-address";

// A Philippine address, from region down to street, each field suggesting places inside
// the one above (RAA-40). Shared by the guest's and the partner's profile forms: each
// form keeps the state with usePhAddress and sends address.toBody(). A guest can pick
// another country (`abroad`), which gets plain fields instead of the PSA suggestions.

type SavedAddress = components["schemas"]["profile_address"];
export type PhAddress = ReturnType<typeof usePhAddress>;

// Partners are in the Philippines; guests come from anywhere. The API accepts any country.
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
  const [country, setCountry] = useState(saved.country ?? COUNTRY);
  const inPh = country === COUNTRY;
  const [region, setRegion] = useState(saved.region ?? "");
  const [province, setProvince] = useState(saved.province ?? "");
  const [city, setCity] = useState(saved.city ?? "");
  const [zip, setZip] = useState(saved.postal_code ?? "");
  const [street, setStreet] = useState(saved.street ?? "");
  // Filled in from the map (RAA-111) and not edited since: the street is a guess until the
  // partner checks it, and the address doesn't move the pin it came from.
  const [fromMap, setFromMap] = useState(false);

  // Codes follow from the names, so a saved address reopens with its suggestions narrowed.
  const ph = usePhAddressData();
  const regionPlace = ph && findByName(ph.regions, region);
  const regionCode = regionPlace?.code;
  const provinces = ph ? provincesOf(ph, regionCode) : [];
  const provincePlace = findByName(provinces, province);
  const provinceCode = provincePlace?.code;
  // Metro Manila has no provinces: its cities hang off the region.
  const hasProvinces = inPh && (!ph || !regionCode || provinces.length > 0);
  const cities = ph && regionCode && (provinceCode || !hasProvinces) ? citiesOf(ph, regionCode, provinceCode) : [];
  const cityCode = findByName(cities, city)?.code;
  const zips = ph ? zipsOf(ph, cityCode) : [];

  // Changing a field clears the ones below it.
  function changeRegion(text: string, option?: ComboboxOption) {
    setFromMap(false);
    setRegion(text);
    // Abroad the fields are plain text: nothing below depends on them.
    if (!inPh) return;
    const next = option?.value ?? (ph && findByName(ph.regions, text)?.code);
    if (next !== regionCode) {
      setProvince("");
      setCity("");
      setZip("");
    }
  }

  function changeProvince(text: string, option?: ComboboxOption) {
    setFromMap(false);
    const next = option?.value ?? findByName(provinces, text)?.code;
    setProvince(text);
    if (next !== provinceCode) {
      setCity("");
      setZip("");
    }
  }

  function changeCity(text: string, option?: ComboboxOption) {
    setFromMap(false);
    if (!inPh) return setCity(text);
    const next = option?.value ?? findByName(cities, text)?.code;
    setCity(text);
    if (next === cityCode) return;
    // A city with one ZIP fills it in.
    const cityZips = ph ? zipsOf(ph, next) : [];
    setZip(cityZips.length === 1 ? cityZips[0] : "");
  }

  // Another country starts the address over: Philippine places mean nothing there.
  function changeCountry(next: string) {
    setFromMap(false);
    setCountry(next);
    if ((next === COUNTRY) === inPh) return;
    setRegion("");
    setProvince("");
    setCity("");
    setZip("");
  }

  return {
    values: { country, region, province, city, zip, street },
    inPh,
    changeCountry,
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
    setZip: (text: string) => {
      setZip(text);
      setFromMap(false);
    },
    setStreet: (text: string) => {
      setStreet(text);
      setFromMap(false);
    },
    fromMap,
    // The address at the pin (RAA-111), into a blank address or one filled from the map
    // before: one the partner typed or edited stays. Fields the lookup can't match to a PSA
    // place stay blank for the partner to pick.
    fillFromPlace: async (place: ReversePlace) => {
      if (!fromMap && [region, province, city, zip, street].some((value) => value.trim())) return;
      if (place.countrycode && place.countrycode !== COUNTRY) return;
      const data = await loadPhAddressData();
      const match = matchPlaces(data, [place.city, place.county, place.district], place.state, place.postcode);
      const road = place.street ?? (place.type === "street" ? place.name : undefined);
      // The barangay; where OpenStreetMap has none, a "city" that matched no PSA town is one.
      const town = match.city?.name.toLowerCase();
      const unmatchedCity = place.city && !(town && town.includes(place.city.toLowerCase())) ? place.city : undefined;
      const barangay = place.locality ?? place.district ?? unmatchedCity;
      const line = [[place.housenumber, road].filter(Boolean).join(" "), barangay]
        .filter((part, index, parts) => part && parts.indexOf(part) === index)
        .join(", ");
      const zips = match.city?.zips ?? [];
      setRegion(match.region?.name ?? "");
      setProvince(match.province?.name ?? "");
      setCity(match.city?.name ?? "");
      setZip(place.postcode && zips.includes(place.postcode) ? place.postcode : zips.length === 1 ? zips[0] : "");
      setStreet(line);
      setFromMap(true);
    },
    // Every field at once, as saved elsewhere (a listing copying its business's address,
    // RAA-101), without the cascade above clearing the fields below.
    setAll: (next: SavedAddress) => {
      setFromMap(false);
      setCountry(next.country ?? COUNTRY);
      setRegion(next.region ?? "");
      setProvince(next.province ?? "");
      setCity(next.city ?? "");
      setZip(next.postal_code ?? "");
      setStreet(next.street ?? "");
    },
    toBody: () => ({
      country,
      region: region.trim(),
      province: hasProvinces ? province.trim() || null : null,
      city: city.trim(),
      postal_code: zip.trim(),
      street: street.trim(),
    }),
  };
}

// `disabled` shows the address without letting it change (a listing using its business's).
// `abroad` lets the country change (guests); partners keep the Philippines.
export function PhAddressFields({
  address,
  disabled,
  abroad,
}: {
  address: PhAddress;
  disabled?: boolean;
  abroad?: boolean;
}) {
  return (
    // Six columns so each field is about as wide as what goes in it; one column on phones.
    <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-6">
      <legend className="mb-3 font-semibold">Address</legend>
      <div className="sm:col-span-2">
        {abroad ? (
          <SelectField
            label="Country"
            name="country"
            data-testid="address-country"
            value={address.values.country}
            onChange={(event) => address.changeCountry(event.target.value)}
            options={COUNTRIES.map((item) => ({ value: item.code, label: `${countryFlag(item.code)} ${item.name}` }))}
          />
        ) : (
          <Field label="Country" name="country" value={`🇵🇭 ${countryName(COUNTRY)}`} disabled readOnly />
        )}
      </div>
      {address.inPh ? (
        <PhPlaceFields address={address} />
      ) : (
        <AbroadFields address={address} />
      )}
    </fieldset>
  );
}

// An address outside the Philippines: plain fields, in the order most countries write them.
function AbroadFields({ address }: { address: PhAddress }) {
  const { values } = address;
  return (
    <>
      <div className="sm:col-span-4">
        <Field
          label="Street"
          name="street"
          required
          autoComplete="street-address"
          value={values.street}
          onChange={(event) => address.setStreet(event.target.value)}
          hint="House or flat number and street"
        />
      </div>
      <div className="sm:col-span-2">
        <Field
          label="City"
          name="city"
          required
          autoComplete="address-level2"
          value={values.city}
          onChange={(event) => address.changeCity(event.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Field
          label="State / province / region"
          name="region"
          required
          autoComplete="address-level1"
          value={values.region}
          onChange={(event) => address.changeRegion(event.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Field
          label="Postal code"
          name="postal_code"
          required
          autoComplete="postal-code"
          value={values.zip}
          onChange={(event) => address.setZip(event.target.value)}
        />
      </div>
    </>
  );
}

// A Philippine address, each field suggesting places inside the one above.
function PhPlaceFields({ address }: { address: PhAddress }) {
  const { values, ph, regionPlace, provinces, provincePlace, hasProvinces, cities, zips } = address;
  return (
    <>
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
          hint={
            address.fromMap
              ? "Filled in from your location. Check it, and add the house or building number."
              : "House or building number, street and barangay"
          }
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
    </>
  );
}
