import { redirect } from "next/navigation";

// /partner itself has no page: partners land on their dashboard (which sends anyone
// else to sign in).
export default function PartnerIndex() {
  redirect("/partner/dashboard");
}
