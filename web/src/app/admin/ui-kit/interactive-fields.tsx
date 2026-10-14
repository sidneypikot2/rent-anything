"use client";

import { useState } from "react";
import { ComboboxField } from "@/components/ui/combobox-field";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { DateRangeField, toDate } from "@/components/ui/date-range-field";
import { MonthCalendar } from "@/components/ui/month-calendar";
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
  // Weekends run; a tap blocks one, frees it, or adds a weekday.
  const [blocked, setBlocked] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const weekend = (iso: string) => [0, 6].includes(toDate(iso).getUTCDay());
  const toggle = (list: string[], iso: string) => (list.includes(iso) ? list.filter((other) => other !== iso) : [...list, iso]);

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
      <div className="flex flex-col gap-1.5 text-sm font-semibold">
        <span>MonthCalendar: a schedule to check and change, a tap per day</span>
        <MonthCalendar
          label="Weekend tour"
          min={todayIso()}
          mark={(iso) => (blocked.includes(iso) ? "blocked" : weekend(iso) ? "open" : added.includes(iso) ? "extra" : undefined)}
          onDayClick={(iso) => (weekend(iso) ? setBlocked(toggle(blocked, iso)) : setAdded(toggle(added, iso)))}
        />
      </div>
      <StepperField label="Guests (StepperField)" hint="Nudged with − and +" value={guests} min={1} max={10} onChange={setGuests} />
    </>
  );
}
