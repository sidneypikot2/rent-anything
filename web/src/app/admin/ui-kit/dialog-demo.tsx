"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Menu } from "@/components/ui/menu";
import { Toast } from "@/components/ui/toast";

// Dialog holds no state of its own, so the UI kit opens it from here.
export function DialogDemo() {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="soft" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Button variant="soft" onClick={() => setSheetOpen(true)}>
        Open sheet
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
    </div>
  );
}

// Toast holds no state of its own either.
export function ToastDemo() {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <Button variant="soft" onClick={() => setMessage("Added to Bantayan Island · Nov 12–15")}>
        Show toast
      </Button>
      <Toast
        message={message}
        onDismiss={() => setMessage(null)}
        actions={
          <button type="button" onClick={() => setMessage(null)} className="hover:underline">
            Rename
          </button>
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
