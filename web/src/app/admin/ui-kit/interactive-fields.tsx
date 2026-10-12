"use client";

import { useState } from "react";
import { ComboboxField } from "@/components/ui/combobox-field";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { DateRangeField } from "@/components/ui/date-range-field";
import { PhoneField } from "@/components/ui/phone-field";
import { StepperField } from "@/components/ui/stepper-field";
import { todayIso } from "@/lib/dates";

const ISLANDS = ["Bantayan", "Bohol", "Camotes", "Malapascua", "Siquijor"].map((name) => ({
  value: name.toLowerCase(),
  label: name,
}));

// The fields that hold their own value, for the UI kit.
export function InteractiveFields() {
  const [island, setIsland] = useState("");
  const [number, setNumber] = useState("");
  const [room, setRoom] = useState("entire");
  const [guests, setGuests] = useState(2);
  const [dates, setDates] = useState({ from: "", to: "" });
  const [day, setDay] = useState({ from: "", to: "" });

  return (
    <>
      <ComboboxField label="Island" value={island} onChange={setIsland} options={ISLANDS} hint="ComboboxField: suggestions, free text allowed" />
      <PhoneField label="Phone" number={number} onNumberChange={setNumber} hint="PhoneField: a Philippine number after +63" />
      <ChoiceCards
        legend="What guests book (ChoiceCards)"
        name="room"
        value={room}
        onChange={setRoom}
        choices={[
          { value: "entire", label: "Entire place", description: "Guests have the whole place to themselves." },
          { value: "room", label: "Private room", description: "Their own room, some shared spaces." },
        ]}
      />
      <DateRangeField
        label="Dates"
        hint="DateRangeField: tap the first day, then the last"
        min={todayIso()}
        from={dates.from}
        to={dates.to}
        onChange={setDates}
        clearable
      />
      <DateRangeField label="Date" hint="DateRangeField single: one day" single min={todayIso()} from={day.from} to={day.to} onChange={setDay} />
      <StepperField label="Guests (StepperField)" hint="Nudged with − and +" value={guests} min={1} max={10} onChange={setGuests} />
    </>
  );
}
