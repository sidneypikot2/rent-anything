// While an area page renders on the server (it waits on the API), the banner's frame and What to
// book's sheet hold their places, so following a link to a destination answers at once.
export default function AreaLoading() {
  return (
    <main role="status" aria-busy className="flex flex-1 flex-col">
      <span className="sr-only">Loading this destination…</span>
      <div className="px-3 pt-3 pb-3 sm:px-6 sm:pb-6">
        <div className="mx-auto flex h-72 w-full max-w-page flex-col justify-end gap-4 rounded-frame bg-navy p-inset sm:h-80">
          <span className="h-4 w-40 rounded-full bg-white/15 motion-safe:animate-pulse" />
          <span className="h-12 w-2/3 max-w-md rounded-control bg-white/20 motion-safe:animate-pulse" />
          <span className="flex gap-2">
            <span className="h-11 w-28 rounded-control bg-white/15 motion-safe:animate-pulse" />
            <span className="h-11 w-36 rounded-control bg-white/15 motion-safe:animate-pulse" />
          </span>
        </div>
      </div>
      <div className="px-3 pb-3 sm:px-6 sm:pb-6">
        {/* The trip lead's one line, then What to book. */}
        <div className="mx-auto mb-3 flex h-24 w-full max-w-page flex-col justify-center gap-2 rounded-frame bg-forest px-5 card-edge sm:h-20 sm:px-card">
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
    </main>
  );
}
