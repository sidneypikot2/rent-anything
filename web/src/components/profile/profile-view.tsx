import type { ReactNode } from "react";
import type { components } from "@/api/schema";
import { Card, CardBody } from "@/components/ui/card";
import { countryName } from "@/lib/countries";

// The read-only blocks of a profile page (RAA-40), used by the guest's and the partner's.

export function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold">{title}</h2>
        <dl className="flex flex-col gap-2">{children}</dl>
      </CardBody>
    </Card>
  );
}

export function ProfileItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

// From country down to street, the order the form asks in.
export function AddressSection({ address }: { address: components["schemas"]["profile_address"] }) {
  const inPh = !address.country || address.country === "PH";
  return (
    <ProfileSection title="Address">
      <ProfileItem label="Country" value={address.country && countryName(address.country)} />
      <ProfileItem label={inPh ? "Region" : "State / province / region"} value={address.region} />
      {address.province && <ProfileItem label="Province" value={address.province} />}
      <ProfileItem label={inPh ? "City / Municipality" : "City"} value={address.city} />
      <ProfileItem label={inPh ? "ZIP code" : "Postal code"} value={address.postal_code} />
      <ProfileItem label="Street" value={address.street} />
    </ProfileSection>
  );
}
