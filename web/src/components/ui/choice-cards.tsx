import { cn } from "./cn";

export type Choice = { value: string; label: string; description?: string };

// A set of radio buttons drawn as cards, each with a line saying what it means: "Entire
// place — Guests have the whole place to themselves." Native radios underneath, so the
// browser's required check and arrow keys work.
export function ChoiceCards({
  legend,
  name,
  choices,
  value,
  onChange,
  required,
  columns = 2,
  "data-testid": testId,
}: {
  legend: string;
  name: string;
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  columns?: 1 | 2;
  "data-testid"?: string;
}) {
  return (
    <fieldset data-testid={testId} className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2")}>
        {choices.map((choice) => (
          <label
            key={choice.value}
            data-testid={testId && `${testId}-${choice.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] bg-surface p-4",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary",
              value === choice.value ? "border-primary bg-surface-2" : "border-line-strong hover:border-primary",
            )}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              required={required}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">{choice.label}</span>
              {choice.description && <span className="text-sm text-muted">{choice.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
