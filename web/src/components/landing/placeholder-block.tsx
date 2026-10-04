// A titled wireframe box standing in for content that doesn't exist yet.
export function PlaceholderBlock({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted">{note}</p>
    </div>
  );
}
