import { Card, CardBody } from "@/components/ui/card";

// A titled wireframe box standing in for content that doesn't exist yet.
export function PlaceholderBlock({ title, note }: { title: string; note: string }) {
  return (
    <Card className="border-dashed">
      <CardBody>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted">{note}</p>
      </CardBody>
    </Card>
  );
}
