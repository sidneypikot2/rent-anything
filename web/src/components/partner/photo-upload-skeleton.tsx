// Where a listing's photos will go (RAA-83). Only the container for now: it takes no files
// and sends nothing, until the API can store photos.
export function PhotoUploadSkeleton() {
  return (
    <div data-testid="listing-photos" className="flex flex-col gap-4">
      <div
        aria-disabled
        className="flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-line-strong bg-surface-2 px-4 py-10 text-center"
      >
        <span aria-hidden className="text-3xl">
          📷
        </span>
        <p className="text-sm font-semibold">Drag photos here or choose them</p>
        <p className="text-xs text-muted">JPG or PNG. The first photo is the cover.</p>
        <p className="text-xs text-muted">Photo upload is coming soon — skip this step for now.</p>
      </div>
      <ul aria-label="Photos" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((slot) => (
          <li key={slot} aria-hidden className="aspect-square animate-pulse rounded-lg bg-surface-2" />
        ))}
      </ul>
    </div>
  );
}
