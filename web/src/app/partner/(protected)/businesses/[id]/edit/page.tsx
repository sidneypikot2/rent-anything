"use client";

import { useParams, useRouter } from "next/navigation";
import { BusinessForm } from "@/components/partner/business-form";
import { usePartnerBusiness, useUpdateBusiness } from "@/components/partner/use-partner-businesses";
import { Button, ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// Changing one of the partner's businesses (RAA-101); saving goes back to the listings.
export default function EditPartnerBusiness() {
  const router = useRouter();
  const id = Number(useParams<{ id: string }>().id);
  const business = usePartnerBusiness(id);
  const update = useUpdateBusiness(id);

  return (
    <main data-testid="partner-business-edit" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-block px-gutter py-page-pad">
      <DisplayTitle>Edit business</DisplayTitle>
      {business.data === null ? (
        <div data-testid="business-missing" className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">This business doesn&apos;t exist, or it isn&apos;t one of yours.</p>
          <ButtonLink href="/partner/listings" size="sm" variant="soft">
            Back to listings
          </ButtonLink>
        </div>
      ) : business.data ? (
        <BusinessForm
          business={business.data}
          onSave={(body) => update.mutate(body, { onSuccess: () => router.push("/partner/listings") })}
          saving={update.isPending}
          error={update.error}
          cancelHref="/partner/listings"
        />
      ) : business.error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load the business.
          </p>
          <Button size="sm" variant="soft" onClick={() => void business.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Loading…</p>
      )}
    </main>
  );
}
