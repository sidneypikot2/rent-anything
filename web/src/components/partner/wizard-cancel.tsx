"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Button, type ButtonStyle } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

// Leaving a listing form that may hold unsaved work: `leave(href, dirty)` goes straight there
// when nothing has been entered, and otherwise opens the dialog this returns, which asks first.
export function useDiscardConfirm({
  title = "Discard this listing?",
  message = "What you've entered so far won't be saved.",
}: { title?: string; message?: string } = {}) {
  const router = useRouter();
  const [href, setHref] = useState<string>();

  function leave(to: string, dirty = true) {
    if (dirty) setHref(to);
    else router.push(to);
  }

  const dialog = (
    <Dialog
      open={href !== undefined}
      onClose={() => setHref(undefined)}
      title={title}
      data-testid="listing-cancel-dialog"
      actions={
        <>
          <Button type="button" variant="soft" onClick={() => setHref(undefined)} data-testid="listing-cancel-keep">
            Keep editing
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => href && router.push(href)}
            data-testid="listing-cancel-discard"
          >
            Discard
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{message}</p>
    </Dialog>
  );

  return { leave, dialog, open: href !== undefined };
}

// A form's way out, kept apart from Back and Next (RAA-97): a quiet Cancel that asks before
// throwing away what the partner has entered. `dirty` says whether there is anything to lose;
// without it, it always asks.
export function WizardCancel({
  href,
  className,
  dirty,
  title,
  message,
  variant = "ghost",
  size = "sm",
}: {
  href: string;
  className?: string;
  dirty?: () => boolean;
  title?: string;
  message?: string;
} & ButtonStyle) {
  const { leave, dialog } = useDiscardConfirm({ title, message });

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => leave(href, dirty ? dirty() : true)}
        data-testid="listing-cancel"
      >
        Cancel
      </Button>
      {dialog}
    </>
  );
}

// The step-1 "Change" link back to the category picker, which leaves the wizard: once a title
// or description is typed it asks first, like Cancel. The link sits in a sentence, so the
// dialog goes to the body (a <dialog> can't be inside a <p>), and only while it is open.
export function ChangeCategoryLink({ href, dirty }: { href: string; dirty: boolean }) {
  const { leave, dialog, open } = useDiscardConfirm();

  return (
    <>
      <Link
        href={href}
        onClick={(event) => {
          if (!dirty) return;
          event.preventDefault();
          leave(href);
        }}
        className="text-link underline"
        data-testid="listing-change-category"
      >
        Change
      </Link>
      {open && createPortal(dialog, document.body)}
    </>
  );
}
