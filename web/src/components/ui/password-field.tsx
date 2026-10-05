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
} & Omit<ComponentProps<"input">, "type">;

// A password input like Field, with a Show/Hide toggle inside it.
export function PasswordField({
  label,
  hint,
  error,
  action,
  visible: controlledVisible,
  onVisibleChange,
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
    <div className="flex flex-col gap-1 text-sm font-medium">
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
            "w-full rounded-lg border-[1.5px] bg-surface py-2 pl-3 pr-16 font-normal text-foreground outline-none",
            "placeholder:text-muted/80 focus:border-primary disabled:bg-surface-2",
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
