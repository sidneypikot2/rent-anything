"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Menu } from "@/components/ui/menu";
import { Toast, type ToastTone } from "@/components/ui/toast";

// Dialog holds no state of its own, so the UI kit opens it from here.
export function DialogDemo() {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

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
        actions={
          <>
            <Button variant="soft" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Dialog: a native modal for confirming a step. Escape or the backdrop closes it.
        </p>
      </Dialog>
      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        placement="sheet"
        title="Add to which trip?"
        actions={<Button onClick={() => setSheetOpen(false)}>Add to trip</Button>}
      >
        <p className="text-sm text-muted">
          placement=&quot;sheet&quot;: a step in a flow. Docked to the bottom on a phone, centred on wider screens.
        </p>
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
