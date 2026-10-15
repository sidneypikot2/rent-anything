import { ChoiceCards } from "@/components/ui/choice-cards";
import { StepperField } from "@/components/ui/stepper-field";
import type { ListingCategory } from "./use-partner-listings";

const MAX_UNITS = 100;

// The step, section and detail heading for it: plain words, not "units".
export const UNITS_LABEL = "How many you have";

type BookingType = NonNullable<ListingCategory["booking_type"]>;

// The question for each kind of listing: identical items, rooms, groups or vehicles.
const WORDING: Record<BookingType, { question: string; count: string }> = {
  rental: { question: "Do you have more than one of this exact item?", count: "How many are available?" },
  stay: { question: "Do you have more than one identical room or unit like this?", count: "How many are available?" },
  activity: { question: "Can you run more than one group of this at the same time?", count: "How many groups at once?" },
  transfer: { question: "Do you have more than one identical vehicle for this?", count: "How many vehicles?" },
};

// How many identical units a listing has (RAA-99): five pairs of fins are one listing with
// five units, each booked on its own. No is one unit; Yes starts at two.
export function UnitsField({
  bookingType,
  value,
  onChange,
}: {
  bookingType: ListingCategory["booking_type"] | undefined;
  value: number;
  onChange: (value: number) => void;
}) {
  const wording = WORDING[bookingType ?? "rental"];
  return (
    <div data-testid="listing-units" className="flex flex-col gap-2">
      <ChoiceCards
        legend={wording.question}
        name="has_units"
        value={value > 1 ? "yes" : "no"}
        onChange={(choice) => onChange(choice === "yes" ? Math.max(value, 2) : 1)}
        choices={[
          { value: "no", label: "No, just one" },
          { value: "yes", label: "Yes, several", description: "Each can be booked at the same time." },
        ]}
        data-testid="listing-units-choice"
      />
      {value > 1 && (
        <StepperField
          label={wording.count}
          value={value}
          onChange={onChange}
          min={2}
          max={MAX_UNITS}
          data-testid="listing-units-count"
        />
      )}
    </div>
  );
}
