import { AreaSheetSkeleton } from "@/components/area/area-sheet-skeleton";

// While an area page renders on the server (it waits on the API), the banner's frame and its
// sections' sheet hold their places, so following a link to a destination answers at once.
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
      <AreaSheetSkeleton busy={false} />
    </main>
  );
}
