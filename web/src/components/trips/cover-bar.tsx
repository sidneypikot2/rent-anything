// How much of the trip's party what's picked covers: seats on the vehicles, beds in the rooms.
// What's picked on the left ("2 people · 1 motorbike, 2 seats"), on the right "Everyone has a
// seat" or who is still left out, and a bar filling as more is picked.
export function CoverBar({
  people,
  covered,
  summary,
  need,
  when,
  done,
  "data-testid": testId,
}: {
  people: number;
  // The people placed so far, up to `people`.
  covered: number;
  summary: string;
  // What someone left out still needs: "a ride", "a bed".
  need: string;
  // The days they need it on, when only some ("Oct 31 – Nov 1, Nov 4–7").
  when?: string;
  done: string;
  "data-testid"?: string;
}) {
  const short = Math.max(people - covered, 0);
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
        <span>{summary}</span>
        <span role="status" className={short > 0 ? "text-warning" : "text-emerald"}>
          {short > 0 ? `${short} of your ${people} still need ${need}${when ? ` ${when}` : ""}` : done}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div
          className="h-full rounded-full bg-action transition-[width] duration-300 ease-calm"
          style={{ width: `${Math.min((covered / Math.max(people, 1)) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
