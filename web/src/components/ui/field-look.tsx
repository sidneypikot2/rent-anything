"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "./cn";

// How the field primitives lay out their label: "stacked" puts it above the field; "floating"
// puts it inside, and it rises onto the top border once the field has focus or a value. Set
// for a part of the app with FieldLook; the partner listing pages try floating first.
export type FieldLookName = "stacked" | "floating";

const FieldLookContext = createContext<FieldLookName>("stacked");

export function FieldLook({ look, children }: { look: FieldLookName; children: ReactNode }) {
  return <FieldLookContext.Provider value={look}>{children}</FieldLookContext.Provider>;
}

export function useFieldLook() {
  return useContext(FieldLookContext);
}

// The control itself: a text input, select or textarea. A floating field is taller, to hold
// the label at rest, and keeps its placeholder hidden until it has focus so the two never
// overlap.
export function controlClasses(look: FieldLookName, error: string | undefined) {
  return cn(
    "rounded-control border bg-surface px-4 font-normal text-foreground outline-none transition-[border-color,box-shadow] duration-300 ease-calm",
    "focus:ring-4 disabled:bg-surface-2",
    look === "floating"
      ? "peer min-h-14 py-3 shadow-xs placeholder:text-transparent focus:placeholder:text-muted/80 hover:border-foreground/60"
      : "min-h-12 py-2.5 placeholder:text-muted/80",
    // An error stays red with focus, so fixing it doesn't hide which field it was.
    error
      ? "border-danger hover:border-danger focus:border-danger focus:ring-danger/10"
      : "border-line-strong focus:border-primary focus:ring-sky-mist",
  );
}

// A floating label, after its control in the DOM (it reads the control's state as a peer).
// At rest it sits where the text will go; with focus or a value it moves onto the top border,
// on a patch of the surface that cuts the border. `raised` keeps it there (a select always
// has a value); `multiline` rests it on a textarea's first line instead of the middle.
export function floatingLabelClasses({
  error,
  raised = false,
  multiline = false,
}: {
  error?: string;
  raised?: boolean;
  multiline?: boolean;
}) {
  const up = "top-0 text-xs font-semibold";
  return cn(
    "pointer-events-none absolute left-3 max-w-[calc(100%-1.5rem)] -translate-y-1/2 truncate rounded-sm bg-surface px-1 leading-tight transition-all duration-300 ease-calm",
    raised
      ? up
      : cn(
          multiline ? "top-6" : "top-7",
          "text-sm font-normal",
          "peer-focus:top-0 peer-focus:text-xs peer-focus:font-semibold",
          "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-semibold",
        ),
    error ? "text-danger" : "text-muted peer-focus:text-primary",
  );
}
