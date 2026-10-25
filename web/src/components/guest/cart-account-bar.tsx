"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { apiClient } from "@/api/client";
import { tripError } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LOGIN_PATHS, withNext } from "@/lib/auth/paths";
import { isAnonymous, useSession } from "@/lib/auth/session";
import { TripLinkCard } from "./trip-link-card";

// The line over the cart for a guest without an account (RAA-177). Before their first
// checkout: "Have an account? Sign in". After it: trips are deleted 60 days after they end
// unless they create an account (/trips/keep), and Reset trip link and PIN, which ends the
// old pair and shows the new one once. Nothing for a registered guest.
export function CartAccountBar() {
  const session = useSession();
  const [resetting, setResetting] = useState(false);
  if (!session || session.user.role !== "guest" || session.user.registered) return null;

  if (isAnonymous(session)) {
    return (
      <p data-testid="cart-account-bar" className="px-gutter text-sm text-muted sm:px-0">
        No account needed to plan and book.{" "}
        <Link href={withNext(LOGIN_PATHS.guest, "/cart")} data-testid="cart-signin" className="font-semibold text-link hover:underline">
          Have an account? Sign in
        </Link>
      </p>
    );
  }

  return (
    <div
      data-testid="cart-account-bar"
      className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-surface-2 px-4 py-3 max-sm:mx-gutter"
    >
      <p className="text-sm text-muted">
        Without an account, a trip is deleted 60 days after it ends.{" "}
        <Link href="/trips/keep" data-testid="cart-keep" className="font-semibold text-link hover:underline">
          Create an account to keep your trips
        </Link>
      </p>
      <Button type="button" size="sm" variant="soft" data-testid="cart-reset-link" onClick={() => setResetting(true)}>
        Reset trip link and PIN
      </Button>
      {resetting && <ResetTripLink onClose={() => setResetting(false)} />}
    </div>
  );
}

// POST /trip_access/rotate: a new link and PIN, after confirming that the old ones stop working.
function ResetTripLink({ onClose }: { onClose: () => void }) {
  const rotate = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient().POST("/api/v1/trip_access/rotate");
      if (!data) throw tripError(error, "Couldn't reset your trip link. Try again.");
      return data;
    },
  });

  return (
    <Dialog
      open
      onClose={() => !rotate.isPending && onClose()}
      placement="sheet"
      title="Reset trip link and PIN"
      data-testid="reset-trip-link"
      actions={
        rotate.data ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="soft" onClick={onClose} disabled={rotate.isPending}>
              Cancel
            </Button>
            <Button type="button" data-testid="reset-trip-link-confirm" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
              {rotate.isPending ? "Resetting…" : "Reset"}
            </Button>
          </>
        )
      }
    >
      {rotate.data ? (
        <TripLinkCard link={rotate.data} />
      ) : (
        <p className="text-sm text-muted">
          Your old trip link and PIN stop working, and a locked link opens again. You&apos;ll get a new pair, shown only
          once, so have somewhere to save it.
        </p>
      )}
      {rotate.error && (
        <p role="alert" className="text-sm text-danger">
          {rotate.error.message}
        </p>
      )}
    </Dialog>
  );
}
