"use client";

import type { CountryCode } from "libphonenumber-js";
import { useState } from "react";
import { ComboboxField } from "@/components/ui/combobox-field";
import { PhoneField } from "@/components/ui/phone-field";

const ISLANDS = ["Bantayan", "Bohol", "Camotes", "Malapascua", "Siquijor"].map((name) => ({
  value: name.toLowerCase(),
  label: name,
}));

// The fields that hold their own value, for the UI kit.
export function InteractiveFields() {
  const [island, setIsland] = useState("");
  const [country, setCountry] = useState<CountryCode>("PH");
  const [number, setNumber] = useState("");

  return (
    <>
      <ComboboxField label="Island" value={island} onChange={setIsland} options={ISLANDS} hint="ComboboxField: suggestions, free text allowed" />
      <PhoneField
        label="Phone with country code"
        country={country}
        number={number}
        onCountryChange={setCountry}
        onNumberChange={setNumber}
        hint="PhoneField"
      />
    </>
  );
}
