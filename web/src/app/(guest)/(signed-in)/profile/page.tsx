"use client";

import { GuestProfileDetails } from "@/components/guest/guest-profile-form";
import { useGuestProfile } from "@/components/guest/use-guest-profile";
import { Button } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";
import { PageSheet } from "@/components/landing/page-sheet";

// The guest's profile: legal name, phone and address (RAA-40).
export default function GuestProfile() {
  const { data, error, refetch } = useGuestProfile();

  return (
    <main data-testid="guest-profile" className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-block px-gutter py-page-pad">
          <DisplayTitle>Profile</DisplayTitle>
          {data ? (
            <GuestProfileDetails profile={data} />
          ) : error ? (
            <div className="flex flex-col items-start gap-3">
              <p role="alert" className="text-sm text-danger">
                Couldn&apos;t load your profile.
              </p>
              <Button size="sm" variant="soft" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">Loading your profile…</p>
          )}
        </div>
      </PageSheet>
    </main>
  );
}
