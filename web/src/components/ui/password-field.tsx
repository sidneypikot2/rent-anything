"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

type Props = {
  label: string;
  hint?: string;
  error?: string;
  // Shown at the right of the label row, e.g. a "Forgot password?" link.
  action?: ReactNode;
  // Controlled visibility, to link several fields (password + confirmation). Omit both
  // and the field keeps its own state.
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  // Smaller, for a small sheet (sign-in), as on Field.
  compact?: boolean;
} & Omit<ComponentProps<"input">, "type">;

// A password input like Field, with a Show/Hide toggle inside it.
export function PasswordField({
  label,
  hint,
  error,
  action,
  visible: controlledVisible,
  onVisibleChange,
  compact = false,
  className,
  id,
  ...props
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const noteId = `${inputId}-note`;
  const note = error ?? hint;
  const [ownVisible, setOwnVisible] = useState(false);
  const visible = controlledVisible ?? ownVisible;
  const setVisible = (next: boolean) => {
    if (controlledVisible === undefined) setOwnVisible(next);
    onVisibleChange?.(next);
  };

  return (
    <div className={cn("flex flex-col font-semibold", compact ? "gap-1 text-small" : "gap-1.5 text-sm")}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId}>{label}</label>
        {action}
      </div>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={cn(
            "w-full rounded-control border bg-surface pr-16 font-normal text-foreground outline-none transition-[border-color,box-shadow] duration-300 ease-calm",
            compact ? "min-h-11 py-2 pl-3 text-base sm:text-control" : "min-h-12 py-2.5 pl-4",
            "placeholder:text-muted/80 focus:border-primary focus:ring-4 focus:ring-sky-mist disabled:bg-surface-2",
            error ? "border-danger" : "border-line-strong",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          aria-controls={inputId}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
          disabled={props.disabled}
          className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-primary hover:text-primary-hover disabled:opacity-50"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {note && (
        <span id={noteId} className={cn("text-xs font-normal", error ? "text-danger" : "text-muted")}>
          {note}
        </span>
      )}
    </div>
  );
}
