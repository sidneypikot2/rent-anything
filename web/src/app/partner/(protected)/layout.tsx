import { PartnerGuard } from "@/components/auth/partner-guard";

// Every partner page except /partner/login lives in this group, behind the guard.
export default function ProtectedPartnerLayout({ children }: LayoutProps<"/partner">) {
  return <PartnerGuard>{children}</PartnerGuard>;
}
