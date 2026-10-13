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

// Then until the partner has a business (RAA-101): each listing belongs to one, and
// travellers see its name. Adding one comes back to adding the listing.
export function BusinessGate() {
  return (
    <Card data-testid="business-gate">
      <CardBody pad="lg" className="flex flex-col items-start gap-4">
        <div>
          <h2 className="font-semibold">Add your business first</h2>
          <p className="mt-1 text-sm text-muted">
            Each listing belongs to one of your businesses, and travellers see its name: your guest house, your
            motorbike rental. Your legal name stays private.
          </p>
        </div>
        <ButtonLink href="/partner/businesses/new?next=/partner/listings/new" data-testid="business-gate-add">
          Add your business
        </ButtonLink>
      </CardBody>
    </Card>
  );
}
