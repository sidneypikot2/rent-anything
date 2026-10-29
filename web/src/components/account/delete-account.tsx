"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { clearSession } from "@/lib/auth/session";

const CONFIRM_WORD = "DELETE";

// DELETE /me: a guest deletes their own account from Settings. Their trips and sign-ins go
// at once; partners keep their records of past bookings. The API refuses (409) while a booking
// is still open, and says so.
function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error, response } = await apiClient().DELETE("/api/v1/me");
      if (!response.ok) throw new Error(error?.error ?? "Couldn't delete your account. Try again.");
    },
  });
}

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  return (
    <Card data-testid="delete-account">
      <CardBody className="flex flex-col items-start gap-3">
        <div>
          <h2 className="font-semibold">Delete your account</h2>
          <p className="mt-1 text-sm text-pretty text-muted">
            Your account, trips and saved items are deleted for good. Partners keep their records of bookings you made.
          </p>
        </div>
        <Button type="button" variant="soft" onClick={() => setOpen(true)} data-testid="delete-account-open">
          Delete account
        </Button>
      </CardBody>
      {open && <DeleteAccountDialog onClose={() => setOpen(false)} />}
    </Card>
  );
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const remove = useDeleteAccount();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { show } = useToast();
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;
  // The session ends once Settings has gone: cleared while it still shows, the signed-in
  // pages' guard would send the guest to sign in instead of home.
  const deleted = useRef(false);
  useEffect(
    () => () => {
      if (!deleted.current) return;
      clearSession({ all: true });
      queryClient.clear();
    },
    [queryClient],
  );

  function onDelete() {
    remove.mutate(undefined, {
      onSuccess: () => {
        deleted.current = true;
        router.replace("/");
        show("Your account has been deleted.", { "data-testid": "account-deleted-toast" });
      },
    });
  }

  return (
    <Dialog
      open
      onClose={() => !remove.isPending && onClose()}
      title="Delete your account?"
      meta="This can't be undone."
      tone="danger"
      data-testid="delete-account-dialog"
      actions={
        <>
          <Button type="button" variant="soft" onClick={onClose} disabled={remove.isPending}>
            Keep it
          </Button>
          <Button
            type="button"
            variant="danger"
            data-testid="delete-account-confirm"
            disabled={!confirmed}
            loading={remove.isPending}
            onClick={onDelete}
          >
            {remove.isPending ? "Deleting…" : "Delete account"}
          </Button>
        </>
      }
    >
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="font-semibold">What goes</dt>
          <dd className="text-muted">Your account, your trips and what&apos;s saved in them, and your sign-ins on every device.</dd>
        </div>
        <div>
          <dt className="font-semibold">What stays</dt>
          <dd className="text-muted">
            Bookings you made, with the name, email and phone you booked with: partners keep them for their records.
          </dd>
        </div>
      </dl>
      <Field
        label={`Type ${CONFIRM_WORD} to confirm`}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        data-testid="delete-account-word"
      />
      {remove.error && (
        <p role="alert" className="text-sm text-danger" data-testid="delete-account-error">
          {remove.error.message}{" "}
          <Link href="/trips" className="font-semibold text-link underline underline-offset-4">
            See your trips
          </Link>
        </p>
      )}
    </Dialog>
  );
}
