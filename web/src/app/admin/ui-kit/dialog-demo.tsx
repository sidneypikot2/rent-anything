"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

// Dialog holds no state of its own, so the UI kit opens it from here.
export function DialogDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="soft" onClick={() => setOpen(true)}>
        Open dialog
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
        <p className="text-sm text-muted">Dialog: a native modal for confirming a step. Escape or the backdrop closes it.</p>
      </Dialog>
    </>
  );
}
