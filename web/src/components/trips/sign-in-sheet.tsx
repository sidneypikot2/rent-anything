"use client";

import { AuthCard } from "@/components/auth/auth-card";
import { REGISTER_PATHS, withNext } from "@/lib/auth/paths";
import { ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  // The page to come back to from /register, where the add finishes.
  next: string | undefined;
  onClose: () => void;
  onSignedIn: () => void;
};

// An account comes before the first add (decision 4). Most who reach it are new, so it leads with
// making one (/register, which comes back here); signing in follows, on this sheet, and carries on
// on the same page.
export function SignInSheet({ open, next, onClose, onSignedIn }: Props) {
  return (
    <Dialog open={open} onClose={onClose} placement="sheet" title="Save this to your trip" data-testid="trip-signin-sheet">
      <p className="text-sm text-pretty text-muted">
        Your trip is kept in a free account. We&apos;ll save this to it and bring you right back.
      </p>
      <ButtonLink href={withNext(REGISTER_PATHS.guest, next)} size="pill" arrow data-testid="trip-signin-create" className="self-stretch justify-between">
        Create a free account
      </ButtonLink>
      {open && <AuthCard role="guest" mode="signin" next={next} onSignedIn={onSignedIn} title="Have an account? Sign in" switchLink={false} />}
    </Dialog>
  );
}
