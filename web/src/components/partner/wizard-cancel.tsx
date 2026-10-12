"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

// A wizard's way out, kept apart from Back and Next (RAA-97): a quiet Cancel that always
// asks before throwing away what the partner has entered.
export function WizardCancel({ href, className }: { href: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
        data-testid="listing-cancel"
      >
        Cancel
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Discard this listing?"
        data-testid="listing-cancel-dialog"
        actions={
          <>
            <Button type="button" variant="soft" onClick={() => setOpen(false)} data-testid="listing-cancel-keep">
              Keep editing
            </Button>
            <Button type="button" variant="danger" onClick={() => router.push(href)} data-testid="listing-cancel-discard">
              Discard
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">What you&apos;ve entered so far won&apos;t be saved.</p>
      </Dialog>
    </>
  );
}
