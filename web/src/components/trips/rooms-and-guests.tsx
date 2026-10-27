"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronGlyph } from "@/components/discovery/tag-glyphs";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { StepperField } from "@/components/ui/stepper-field";
import {
  emptyRoom,
  MAX_INFANTS_PER_ROOM,
  partySummary,
  roomMax,
  roomText,
  unplacedText,
  type Kind,
  type Room,
  type StayRules,
} from "./party";

type Props = {
  rooms: Room[];
  pets: number;
  onChange: (rooms: Room[], pets: number) => void;
  rules: StayRules;
  // The trip's party, to say who the rooms leave out.
  party?: Room;
  label?: string;
  // Inside a sheet, the desktop panel opens under the field rather than floating over the
  // sheet's edge (a phone always gets its own sheet).
  inline?: boolean;
  // What the pets stepper says under its label; by default, the stay's limit.
  petsHint?: string;
  disabled?: boolean;
  "data-testid"?: string;
};

// The width from which the picker is a popover; below it, a bottom sheet (Tailwind's sm).
const WIDE = "(min-width: 40rem)";

const KIND_LABELS: Record<Kind, { label: string; hint?: string }> = {
  adults: { label: "Adults" },
  children: { label: "Children", hint: "Ages 2–12" },
  infants: { label: "Infants", hint: "Under 2" },
};

// Rooms and guests for a stay (RAA-184): a summary field that opens a bottom sheet on a phone and
// a popover from sm. Each room has its adults (at least one), children and infants, and + stops
// once its beds are full, counting only the guests the place counts (party.ts); "Add a room" while
// the stay has rooms left, Remove from two rooms. Pets are for the whole stay, only where it takes
// them. Whoever the rooms leave out of the trip's party is a hint, never a block.
export function RoomsAndGuests({
  rooms,
  pets,
  onChange,
  rules,
  party,
  label = "Rooms and guests",
  inline = false,
  petsHint,
  disabled,
  "data-testid": testId,
}: Props) {
  const [open, setOpen] = useState<"popover" | "sheet" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const valueId = useId();
  const panelId = useId();
  const left = party ? unplacedText(party, rooms) : null;

  useEffect(() => {
    if (open !== "popover" || inline) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, inline]);

  function close() {
    setOpen(null);
    trigger.current?.focus();
  }

  // Escape closes the popover only, not a sheet the field is in.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || open !== "popover") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  const setRoom = (index: number, room: Room) => onChange(rooms.map((each, i) => (i === index ? room : each)), pets);
  const canAddRoom = !rules.shared && (rules.rooms === null || rooms.length < rules.rooms);

  const body = (
    <div className="flex flex-col gap-4">
      {rooms.map((room, index) => (
        <div
          key={index}
          role="group"
          aria-label={rules.shared ? "Guests" : `Room ${index + 1}`}
          className="flex flex-col gap-1"
          data-testid={testId && `${testId}-room`}
        >
          {!rules.shared && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Room {index + 1}</p>
              {rooms.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(rooms.filter((_, i) => i !== index), pets)}
                  className="tap-target text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  data-testid={testId && `${testId}-remove-room`}
                >
                  Remove
                </button>
              )}
            </div>
          )}
          {(Object.keys(KIND_LABELS) as Kind[]).map((kind) => (
            <StepperField
              key={kind}
              label={KIND_LABELS[kind].label}
              hint={kindHint(kind, room, rules)}
              value={room[kind]}
              min={kind === "adults" ? 1 : 0}
              max={Math.max(roomMax(room, kind, rules), room[kind])}
              onChange={(value) => setRoom(index, { ...room, [kind]: value })}
              data-testid={testId && `${testId}-${kind}`}
            />
          ))}
        </div>
      ))}

      {canAddRoom && (
        <Button
          type="button"
          variant="soft"
          glyph="plus"
          className="self-start"
          onClick={() => onChange([...rooms, emptyRoom()], pets)}
          data-testid={testId && `${testId}-add-room`}
        >
          Add a room
        </Button>
      )}

      {rules.pets !== 0 && (
        <div className="border-t border-line pt-3">
          <StepperField
            label="Pets"
            hint={petsHint ?? (rules.pets ? `Up to ${rules.pets} for the stay` : "For the whole stay")}
            value={pets}
            max={rules.pets ?? 20}
            onChange={(value) => onChange(rooms, value)}
            data-testid={testId && `${testId}-pets`}
          />
        </div>
      )}

      {left && (
        <p role="status" className="rounded-control bg-mist px-3 py-2 text-sm" data-testid={testId && `${testId}-left`}>
          Not in a room yet: {left}.{" "}
          {canAddRoom ? "Add a room, or book another stay for them." : "Book another stay for them."}
        </p>
      )}
    </div>
  );

  return (
    <div ref={root} onKeyDown={onKeyDown} className="relative flex flex-col gap-1.5 text-sm font-semibold">
      <span id={labelId}>{label}</span>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-expanded={open !== null}
        aria-controls={open === "popover" ? panelId : undefined}
        data-testid={testId}
        onClick={() => setOpen(open ? null : window.matchMedia(WIDE).matches ? "popover" : "sheet")}
        className={cn(
          "flex min-h-12 items-center justify-between gap-2 rounded-control border border-line-strong bg-surface px-4 py-2.5 text-left font-normal outline-none",
          "focus:border-primary focus:ring-4 focus:ring-sky-mist disabled:bg-surface-2",
          open && "border-primary",
        )}
      >
        <span id={valueId} className="flex min-w-0 flex-col">
          <span>{partySummary(rooms, pets)}</span>
          {rooms.length > 1 && <span className="truncate text-xs text-muted">{rooms.map(roomText).join(" · ")}</span>}
        </span>
        <ChevronGlyph direction={open ? "up" : "down"} className="size-5 shrink-0 text-primary" />
      </button>
      {left && !open && <span className="text-xs font-normal text-muted">Not in a room yet: {left}</span>}

      {open === "popover" && (
        <Panel id={panelId} label={label} inline={inline} onDone={close}>
          {body}
        </Panel>
      )}
      <Dialog open={open === "sheet"} onClose={() => setOpen(null)} placement="sheet" title={label}>
        <div className="flex flex-col gap-4 font-normal">
          {body}
          <Button type="button" onClick={() => setOpen(null)} className="self-end" data-testid={testId && `${testId}-done`}>
            Done
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function Panel({ id, label, inline, onDone, children }: { id: string; label: string; inline: boolean; onDone: () => void; children: ReactNode }) {
  return (
    <div
      id={id}
      role="group"
      aria-label={label}
      className={cn(
        "flex w-full flex-col gap-3 card-edge rounded-control bg-surface p-4 font-normal",
        inline ? "mt-1" : "absolute left-0 top-full z-20 mt-1 max-h-[70vh] overflow-y-auto shadow-lift sm:w-96",
      )}
    >
      {children}
      <div className="flex justify-end">
        <button type="button" onClick={onDone} className="rounded-control px-2 py-1 text-sm font-medium text-primary hover:bg-surface-2">
          Done
        </button>
      </div>
    </div>
  );
}

// Why + stopped, once it has: the room's beds are full, or its infants at the cap.
function kindHint(kind: Kind, room: Room, rules: StayRules) {
  const full = room[kind] >= roomMax(room, kind, rules);
  if (kind === "infants" && !rules.shared && room.infants >= MAX_INFANTS_PER_ROOM) return `Up to ${MAX_INFANTS_PER_ROOM} a room`;
  if (full && rules.sleeps) return rules.shared ? `Up to ${rules.sleeps} guests` : `Room is full (sleeps ${rules.sleeps})`;
  if (kind === "infants" && !rules.countsInfants) return "Under 2 · no bed needed";
  return KIND_LABELS[kind].hint;
}
