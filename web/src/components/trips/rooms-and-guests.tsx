"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CategoryGlyph, ChevronGlyph } from "@/components/discovery/tag-glyphs";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog, DialogSummary } from "@/components/ui/dialog";
import { StepperField } from "@/components/ui/stepper-field";
import { formatPeso } from "@/lib/money";
import {
  emptyRoom,
  counted,
  KINDS,
  partySummary,
  roomMax,
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
  // The guests the search asked for (RAA-188): only their counters show. Left out, every one does.
  searched?: Searched;
  label?: string;
  // Inside a sheet, the desktop panel opens under the field rather than floating over the
  // sheet's edge (a phone always gets its own sheet).
  inline?: boolean;
  // A ticket row in a dialog (the modal redesign): a bed in its well, the label over the summary,
  // a chevron; the desktop panel opens under it, inside the ticket.
  row?: boolean;
  // What the pets stepper says under its label; by default, the stay's limit.
  petsHint?: string;
  disabled?: boolean;
  "data-testid"?: string;
};

// The width from which the picker is a popover; below it, a bottom sheet (Tailwind's sm).
const WIDE = "(min-width: 40rem)";

const KIND_LABELS: Record<Kind, { label: string; age: string }> = {
  adults: { label: "Adults", age: "13+" },
  children: { label: "Children", age: "2–12" },
  infants: { label: "Infants", age: "under 2" },
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
  row = false,
  searched,
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


  // Only a floating popover closes on a click outside it. One laid out in the sheet (inline, or a
  // ticket row) stays: closing it on pointerdown shrinks the sheet, so the click meant for the
  // sheet's button lands on its backdrop and closes the sheet instead.
  useEffect(() => {
    if (open !== "popover" || inline || row) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, inline, row]);

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
  const kinds = shownKinds(rooms, searched);
  const canAddRoom = !rules.shared && (rules.rooms === null || rooms.length < rules.rooms);

  const body = (
    <div className="flex flex-col gap-4">
      {rooms.map((room, index) => (
        <RoomBlock
          key={index}
          room={room}
          title={rules.shared ? null : `Room ${index + 1}`}
          rules={rules}
          kinds={kinds}
          onChange={(next) => setRoom(index, next)}
          onRemove={rooms.length > 1 ? () => onChange(rooms.filter((_, i) => i !== index), pets) : undefined}
          testId={testId}
        />
      ))}

      {canAddRoom && (
        <Button
          type="button"
          variant="ghost"
          className="self-start"
          onClick={() => onChange([...rooms, emptyRoom()], pets)}
          data-testid={testId && `${testId}-add-room`}
        >
          + Add a room
        </Button>
      )}

      {rules.pets !== 0 && (!searched || searched.pets > 0 || pets > 0) && (
        <div className="border-t border-line pt-3">
          <StepperField
            label="Pets"
            hint={petsHint ?? petsLine(rules)}
            value={pets}
            max={rules.pets ?? 20}
            onChange={(value) => onChange(rooms, value)}
            data-testid={testId && `${testId}-pets`}
          />
        </div>
      )}

      {left && (
        <p role="status" className="rounded-control bg-mist px-3 py-2 text-sm" data-testid={testId && `${testId}-left`}>
          {left} {canAddRoom ? "Add a room, or book another stay for them." : "Book another stay for them."}
        </p>
      )}
    </div>
  );

  return (
    <div ref={root} onKeyDown={onKeyDown} className={cn("relative flex flex-col text-sm font-semibold", !row && "gap-1.5")}>
      {row ? (
        <button
          ref={trigger}
          type="button"
          disabled={disabled}
          aria-labelledby={`${labelId} ${valueId}`}
          aria-expanded={open !== null}
          aria-controls={open === "popover" ? panelId : undefined}
          data-testid={testId}
          onClick={() => setOpen(open ? null : window.matchMedia(WIDE).matches ? "popover" : "sheet")}
          className="flex min-h-16 w-full items-center gap-3 px-3.5 py-3 text-left outline-none transition-colors duration-300 ease-calm hover:bg-surface-2 focus-visible:bg-surface-2 disabled:opacity-50"
        >
          <span className="flex size-9.5 shrink-0 items-center justify-center rounded-xl bg-action-tint text-action-ink">
            <CategoryGlyph name="Hotel or cottage" className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span id={labelId} className="text-xs font-semibold text-muted">
              {label}
            </span>
            <span id={valueId} className="text-control font-bold">
              {partySummary(rooms, pets, rules.shared)}
            </span>
            {left && !open && (
              <span className="text-xs font-normal text-warning" data-testid={testId && `${testId}-hint`}>
                {left}
              </span>
            )}
          </span>
          <ChevronGlyph direction={open === "popover" ? "down" : "right"} className="size-4.5 shrink-0 text-muted" />
        </button>
      ) : (
      <>
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
        <span id={valueId}>{partySummary(rooms, pets, rules.shared)}</span>
        <ChevronGlyph direction={open ? "down" : "right"} className="size-5 shrink-0 text-primary" />
      </button>
      {left && !open && (
        <span className="text-xs font-normal text-warning" data-testid={testId && `${testId}-hint`}>
          {left}
        </span>
      )}
      </>
      )}

      {open === "popover" && (
        <Panel id={panelId} label={label} inline={inline || row} row={row} onDone={close}>
          {body}
        </Panel>
      )}
      <Dialog
        open={open === "sheet"}
        onClose={() => setOpen(null)}
        placement="sheet"
        title={label}
        summary={<DialogSummary value={partySummary(rooms, pets, rules.shared)} />}
        actions={
          <Button type="button" onClick={() => setOpen(null)} data-testid={testId && `${testId}-done`}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-4 font-normal">{body}</div>
      </Dialog>
    </div>
  );
}

// The guests a search asked for (RAA-188), beside its adults.
export type Searched = { children: number; infants: number; pets: number };

// The counters to show: adults always; children and infants only when the search has them or a
// room already holds one, so a search for adults alone isn't asked about children.
export function shownKinds(rooms: Room[], searched?: Searched): Kind[] {
  return KINDS.filter(
    (kind) => kind === "adults" || !searched || searched[kind] > 0 || rooms.some((room) => room[kind] > 0),
  );
}

// One room's counters (Room 1, its adults, children and infants) and the beds it fills: the
// picker's rooms, and each room under its type in a mix of room types (StayMixPicker).
export function RoomBlock({
  room,
  title,
  rules,
  kinds = [...KINDS],
  onChange,
  onRemove,
  testId,
}: {
  room: Room;
  // "Room 1"; null for a shared room, which is one group.
  title: string | null;
  rules: StayRules;
  kinds?: Kind[];
  onChange: (room: Room) => void;
  onRemove?: () => void;
  testId?: string;
}) {
  return (
    <div role="group" aria-label={title ?? "Guests"} className="flex flex-col gap-1" data-testid={testId && `${testId}-room`}>
      {title && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{title}</p>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="tap-target text-sm font-semibold text-link underline underline-offset-4 hover:text-primary"
              data-testid={testId && `${testId}-remove-room`}
            >
              Remove
            </button>
          )}
        </div>
      )}
      {kinds.map((kind) => (
        <StepperField
          key={kind}
          label={KIND_LABELS[kind].label}
          hint={kindHint(kind, rules)}
          value={room[kind]}
          min={kind === "adults" ? 1 : 0}
          max={Math.max(roomMax(room, kind, rules), room[kind])}
          onChange={(value) => onChange({ ...room, [kind]: value })}
          data-testid={testId && `${testId}-${kind}`}
        />
      ))}
      <BedsLine room={room} rules={rules} />
    </div>
  );
}

function Panel({ id, label, inline, row = false, onDone, children }: { id: string; label: string; inline: boolean; row?: boolean; onDone: () => void; children: ReactNode }) {
  // Opened low on the screen, it scrolls the page so it shows whole, Done included.
  const panel = useRef<HTMLDivElement>(null);
  // A block body: newer browsers return a Promise from scrollIntoView, which an effect can't return.
  useEffect(() => {
    panel.current?.scrollIntoView({ block: "nearest" });
  }, []);
  return (
    <div
      ref={panel}
      id={id}
      role="group"
      aria-label={label}
      className={cn(
        "flex w-full flex-col gap-3 bg-surface p-4 font-normal",
        row ? "scroll-mb-4 border-t border-line" : "card-edge rounded-control",
        !row && (inline ? "mt-1 scroll-mb-4" : "absolute left-0 top-full z-20 mt-1 max-h-[70vh] scroll-mb-20 overflow-y-auto shadow-lift sm:w-96"),
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

// A stepper's muted note: its ages, and " · no bed" for guests the place doesn't put in a bed.
function kindHint(kind: Kind, rules: StayRules) {
  const noBed = (kind === "children" && !rules.countsChildren) || (kind === "infants" && !rules.countsInfants);
  return `${KIND_LABELS[kind].age}${noBed && !rules.shared ? " · no bed" : ""}`;
}

// Under a room's steppers: "4 of 5 beds", the guests it puts in a bed; red when it holds more
// than its beds (a split saved before the place changed them).
function BedsLine({ room, rules }: { room: Room; rules: StayRules }) {
  if (!rules.sleeps || rules.shared) return null;
  const taken = counted(room, rules);
  const over = taken > rules.sleeps;
  return (
    <p className={cn("text-xs", over ? "text-danger" : "text-muted")} data-testid="rooms-beds">
      {taken} of {rules.sleeps} beds{over ? " · too many after the capacity change" : ""}
    </p>
  );
}

// "Up to 2 for the stay · ₱200 each": the stay's pet limit and, when the page has it, its fee.
function petsLine(rules: StayRules) {
  const limit = rules.pets ? `Up to ${rules.pets} for the stay` : "For the whole stay";
  const fee = rules.petFee ? `${formatPeso(rules.petFee.cents)} each${rules.petFee.perNight ? " a night" : ""}` : null;
  return [limit, fee].filter(Boolean).join(" · ");
}
