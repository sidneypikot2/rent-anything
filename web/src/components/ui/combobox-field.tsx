"use client";

import { useId, useMemo, useState, type ComponentProps, type KeyboardEvent } from "react";
import { cn } from "./cn";

export type ComboboxOption = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  // Called on every keystroke with the text, and with the option when one is picked.
  onChange: (text: string, option?: ComboboxOption) => void;
  options: ComboboxOption[];
  hint?: string;
  error?: string;
} & Omit<ComponentProps<"input">, "value" | "onChange" | "role">;

const MAX_SHOWN = 50;

// Accents and case don't matter: "paranaque" finds "Parañaque".
function fold(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// A text field with suggestions (the ARIA combobox pattern): typing filters the list,
// arrow keys move through it, Enter or a click picks, Escape closes. Free text is kept, so
// it works with no options at all.
export function ComboboxField({ label, value, onChange, options, hint, error, className, disabled, ...props }: Props) {
  const inputId = useId();
  const listId = useId();
  const noteId = useId();
  const note = error ?? hint;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const shown = useMemo(() => {
    const query = fold(value.trim());
    const exact = options.some((o) => fold(o.label) === query);
    // Once a pick fills the field, show the whole list again rather than just that one.
    const matches = query && !exact ? options.filter((o) => fold(o.label).includes(query)) : options;
    return matches.slice(0, MAX_SHOWN);
  }, [options, value]);

  const expanded = open && shown.length > 0 && !disabled;

  function pick(option: ComboboxOption) {
    onChange(option.label, option);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, shown.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && expanded && active >= 0) {
      event.preventDefault();
      pick(shown[active]);
    } else if (event.key === "Escape" && expanded) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5 text-sm font-semibold">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cn(
          "min-h-12 rounded-control border bg-surface px-4 py-2.5 font-normal text-foreground outline-none transition-[border-color,box-shadow] duration-300 ease-calm",
          "placeholder:text-muted/80 focus:border-primary focus:ring-4 focus:ring-sky-mist disabled:bg-surface-2",
          error ? "border-danger" : "border-line-strong",
          className,
        )}
        {...props}
      />
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute top-full z-20 mt-1 max-h-60 w-full overflow-y-auto card-edge rounded-control bg-surface py-1 font-normal shadow-lift"
        >
          {shown.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown, not click: the input's blur would close the list first.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(option);
              }}
              className={cn("cursor-pointer px-4 py-2.5 text-foreground", index === active && "bg-surface-2")}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
      {note && (
        <span id={noteId} className={cn("text-xs font-normal", error ? "text-danger" : "text-muted")}>
          {note}
        </span>
      )}
    </div>
  );
}
