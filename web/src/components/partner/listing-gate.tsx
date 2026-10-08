import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

// In place of the add-listing steps until the partner's ID is verified (RAA-44).
export function ListingGate() {
  return (
    <Card data-testid="listing-gate">
      <CardBody pad="lg" className="flex flex-col items-start gap-4">
        <div>
          <h2 className="font-semibold">Verify your ID first</h2>
          <p className="mt-1 text-sm text-muted">
            Every partner verifies their ID before adding a listing. It takes a few minutes: a government ID and a
            selfie.
          </p>
        </div>
        <ButtonLink href="/partner/verify" data-testid="listing-gate-verify">
          Verify your ID
        </ButtonLink>
      </CardBody>
    </Card>
  );
}
