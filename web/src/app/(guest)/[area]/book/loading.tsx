// While a place's What to book renders on the server (it waits on the API), its compact banner
// and the list's sheet hold their places, so following a See all or a search answers at once.
export default function AreaBookLoading() {
  return (
    <main role="status" aria-busy className="flex flex-1 flex-col">
      <span className="sr-only">Loading what to book…</span>
      <div className="px-3 pt-3 pb-3 sm:px-6 sm:pb-6">
        <div className="mx-auto flex h-36 w-full max-w-page flex-col justify-end gap-3 rounded-frame bg-navy p-inset">
          <span className="h-4 w-32 rounded-full bg-white/15 motion-safe:animate-pulse" />
          <span className="h-10 w-2/3 max-w-md rounded-control bg-white/20 motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="px-3 pb-3 sm:px-6 sm:pb-6">
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
