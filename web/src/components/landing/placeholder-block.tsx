// A titled wireframe box standing in for content that doesn't exist yet.
export function PlaceholderBlock({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-neutral-500">{note}</p>
    </div>
  );
}
