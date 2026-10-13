"use client";

import Link from "next/link";
import { useState } from "react";
import type { PhAddress } from "@/components/address/ph-address-fields";
import { CheckboxField } from "@/components/ui/checkbox-field";
import type { LatLng } from "@/lib/map";
import { addressChanged, geocodeQuery } from "./listing-fields";
import type { PartnerBusiness } from "./use-partner-businesses";

// A business made before addresses and pins (the RAA-100 backfill) may have neither yet.
function canCopy(business: PartnerBusiness) {
  const { street, city, region, postal_code } = business.address;
  return Boolean(business.location && street && city && region && postal_code);
}

// "Same as Business Address" on a new listing (RAA-101): ticking it copies the business's
// address and pin into the listing and locks them; unticking keeps the copy, editable. The
// map looks the address up again only once it differs from the business's, so unticking
// doesn't move the pin off the business's.
export function useSameAsBusinessAddress(
  business: PartnerBusiness,
  address: PhAddress,
  onCopyPin: (point: LatLng) => void,
) {
  const [same, setSame] = useState(false);
  const [copied, setCopied] = useState(false);

  function change(next: boolean) {
    setSame(next);
    if (next && business.location) {
      address.setAll(business.address);
      onCopyPin(business.location);
      setCopied(true);
    }
  }

  const query = same || (copied && !addressChanged(address, business.address)) ? undefined : geocodeQuery(address);
  return { same, change, geocodeQuery: query };
}

export function SameAsBusinessAddress({
  business,
  checked,
  onChange,
}: {
  business: PartnerBusiness;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const usable = canCopy(business);

  return (
    <div className="flex flex-col gap-1">
      <CheckboxField
        label="Same as Business Address"
        data-testid="same-as-business-address"
        checked={checked}
        disabled={!usable}
        onChange={(event) => onChange(event.target.checked)}
      />
      {!usable && (
        <p className="text-xs text-muted">
          {business.name} has no address and map pin yet.{" "}
          <Link className="text-link underline" href={`/partner/businesses/${business.id}/edit`}>
            Add them
          </Link>{" "}
          to copy them here.
        </p>
      )}
    </div>
  );
}
