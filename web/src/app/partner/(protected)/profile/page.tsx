"use client";

import { ProfileDetails } from "@/components/partner/profile-form";
import { usePartnerProfile } from "@/components/partner/use-partner-profile";
import { Button } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// The partner's profile: legal name, phone and business address (RAA-40).
export default function PartnerProfile() {
  const { data, error, refetch } = usePartnerProfile();

  return (
    <main data-testid="partner-profile" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Profile</DisplayTitle>
      {data ? (
        <ProfileDetails profile={data} />
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
    </main>
  );
}
