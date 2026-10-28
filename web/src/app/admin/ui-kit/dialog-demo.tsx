"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BagGlyph, CalendarGlyph, GuestsGlyph } from "@/components/discovery/tag-glyphs";
import { Dialog, DialogSummary } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper-field";
import { Ticket, TicketNote, TicketRow } from "@/components/ui/ticket";
import { Menu } from "@/components/ui/menu";
import { Toast, type ToastTone } from "@/components/ui/toast";

// Dialog holds no state of its own, so the UI kit opens it from here.
export function DialogDemo() {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [guests, setGuests] = useState(2);

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="soft" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Button variant="soft" onClick={() => setSheetOpen(true)}>
        Open sheet
      </Button>
      <Button variant="soft" onClick={() => setSideOpen(true)}>
        Open side panel
      </Button>
      <Button variant="soft" onClick={() => setOverlayOpen(true)}>
        Open overlay
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this listing?"
        meta="It comes off the site for good."
        tone="danger"
        actions={
          <>
            <Button variant="soft" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          A confirmation (tone=&quot;danger&quot;): the alert disc, the safe action first and the danger one last.
        </p>
      </Dialog>
      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        placement="sheet"
        title="Virgin Island hopping"
        meta="Tour · Kota Beach Boat Tours"
        summary={<DialogSummary value="₱3,000" detail="2 guests" />}
        actions={<Button glyph="plus" onClick={() => setSheetOpen(false)}>Start a trip</Button>}
      >
        <Ticket>
          <TicketRow icon={<BagGlyph />} label="Trip" value="New trip" detail="Bantayan Island" />
          <TicketRow icon={<CalendarGlyph />} label="Date" value="Sat, Oct 28" onClick={() => {}} />
          <TicketRow
            icon={<GuestsGlyph />}
            value="Guests"
            detail="up to 12"
            control={<Stepper label="Guests" value={guests} onChange={setGuests} min={1} max={12} />}
          />
          <TicketNote>A Ticket: the choices as rows, notes in its foot. Named after the thing, never the action.</TicketNote>
        </Ticket>
      </Dialog>
      <Dialog
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        placement="side"
        title="Kota Beach"
        actions={<Button onClick={() => setSideOpen(false)}>Add to trip</Button>}
      >
        <p className="text-sm text-muted">
          placement=&quot;side&quot;: the whole of something on the page, beside it. The title and close button stay at
          the top and the actions at the foot; what&apos;s between scrolls. A click beside it closes it.
        </p>
      </Dialog>
      <Dialog
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        placement="overlay"
        title="Island hopping tour"
        actions={
          <>
            <span className="text-xs text-muted">Answer by tomorrow, 9:00</span>
            <Button onClick={() => setOverlayOpen(false)}>Accept</Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          placement=&quot;overlay&quot;: the whole of a record on a work screen, centred and wider. The title stays at
          the top and the actions at the foot; what&apos;s between scrolls.
        </p>
      </Dialog>
    </div>
  );
}

// Toast holds no state of its own either. Pages show theirs through useToast() (ToastProvider).
export function ToastDemo() {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button variant="soft" onClick={() => setToast({ message: "Added to Bantayan Island · Nov 12–15", tone: "default" })}>
          Show toast
        </Button>
        <Button variant="soft" onClick={() => setToast({ message: "Couldn't remove it. Try again.", tone: "danger" })}>
          Show error toast
        </Button>
      </div>
      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone}
        onDismiss={() => setToast(null)}
        actions={
          toast?.tone === "default" && (
            <button type="button" onClick={() => setToast(null)} className="hover:underline">
              Rename
            </button>
          )
        }
      />
    </>
  );
}

// Menu's actions are callbacks, so the UI kit renders it from here too.
export function MenuDemo() {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Menu
        label="Actions for Island hopping"
        items={[
          { label: "Move to another trip", onSelect: () => setPicked("Move") },
          { label: "Merge with another trip", detail: "Moves every item into it", onSelect: () => setPicked("Merge") },
          { label: "Remove", danger: true, onSelect: () => setPicked("Remove") },
        ]}
      />
      <span className="text-sm text-muted">{picked ? `Picked: ${picked}` : "Open the ⋯ menu"}</span>
    </div>
  );
}
