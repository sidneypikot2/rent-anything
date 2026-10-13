"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BusinessForm } from "@/components/partner/business-form";
import { useCreateBusiness } from "@/components/partner/use-partner-businesses";
import { DisplayTitle } from "@/components/ui/typography";
import { safeNextPath } from "@/lib/auth/paths";

// Only a page of this site, so ?next= can't send the partner off-site.
function partnerPath(next: string | null) {
  return safeNextPath(next) ?? "/partner/listings";
}

// Adding a business (RAA-101). Saving goes to ?next= (adding a listing sends the partner
// here first and back again), else to the listings, grouped by business.
export default function NewPartnerBusiness() {
  return (
    <Suspense>
      <NewBusiness />
    </Suspense>
  );
}

function NewBusiness() {
  const router = useRouter();
  const next = partnerPath(useSearchParams().get("next"));
  const create = useCreateBusiness();

  return (
    <main data-testid="partner-business-new" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <DisplayTitle>Add a business</DisplayTitle>
        <p className="max-w-prose text-sm text-muted">
          Each listing belongs to one of your businesses: a guest house, a motorbike rental. Travellers see its name.
        </p>
      </div>
      <BusinessForm
        onSave={(body) => create.mutate(body, { onSuccess: () => router.push(next) })}
        saving={create.isPending}
        error={create.error}
        cancelHref={next}
      />
    </main>
  );
}
