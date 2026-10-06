"use client";

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
  const [number, setNumber] = useState("");

  return (
    <>
      <ComboboxField label="Island" value={island} onChange={setIsland} options={ISLANDS} hint="ComboboxField: suggestions, free text allowed" />
      <PhoneField label="Phone" number={number} onNumberChange={setNumber} hint="PhoneField: a Philippine number after +63" />
    </>
  );
}
