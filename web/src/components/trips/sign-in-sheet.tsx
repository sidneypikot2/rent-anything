"use client";

import { AuthCard } from "@/components/auth/auth-card";
import { Dialog } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  // The page to come back to from /register, where the add finishes.
  next: string | undefined;
  onClose: () => void;
  onSignedIn: () => void;
};

// Sign-in comes before the first add (decision 4). It opens over the listing, so signing
// in here carries on on the same page; "Create one" goes to /register and comes back.
export function SignInSheet({ open, next, onClose, onSignedIn }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      placement="sheet"
      title="Sign in to start a trip"
      data-testid="trip-signin-sheet"
    >
      <p className="text-sm text-muted">We&apos;ll save this to your trip and bring you right back.</p>
      {open && <AuthCard role="guest" mode="signin" next={next} onSignedIn={onSignedIn} />}
    </Dialog>
  );
}
