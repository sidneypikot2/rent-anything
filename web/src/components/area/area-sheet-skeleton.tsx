// The place page's sheet while its rows and what's nearby load: the trip lead's one line, on the
// trip band's colour (navy on guest pages), then the sections. The page's loading.tsx shows it
// under the banner's frame, and the page itself while the banner is already in (RAA-231).
export function AreaSheetSkeleton({ busy = true }: { busy?: boolean }) {
  return (
    <div role={busy ? "status" : undefined} aria-busy={busy || undefined} className="px-3 pb-3 sm:px-6 sm:pb-6">
      {busy && <span className="sr-only">Loading what to book here…</span>}
      <div className="mx-auto mb-3 flex h-24 w-full max-w-page flex-col justify-center gap-2 rounded-frame bg-trip-band px-5 card-edge sm:h-20 sm:px-card">
        <span className="h-5 w-64 max-w-full rounded-full bg-white/15 motion-safe:animate-pulse" />
        <span className="h-4 w-44 rounded-full bg-white/10 motion-safe:animate-pulse" />
      </div>
      <div className="mx-auto flex w-full max-w-page flex-col gap-3 rounded-frame bg-surface-2 p-inset card-edge shadow-float">
        <span className="h-8 w-48 rounded-control bg-mist motion-safe:animate-pulse" />
        {[0, 1, 2].map((row) => (
          <span key={row} className="h-40 rounded-card bg-surface card-edge motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
