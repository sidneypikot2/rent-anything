import { FieldLook } from "@/components/ui/field-look";

// The listing pages try the floating-label fields before the rest of the app.
export default function PartnerListingsLayout({ children }: LayoutProps<"/partner/listings">) {
  return <FieldLook look="floating">{children}</FieldLook>;
}
