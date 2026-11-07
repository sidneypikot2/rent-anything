import { HomePlanButton } from "./home-plan-button";
import { BOOKING_STATE, LAUNCH_AREA } from "./launch-area";

// Only what is true today: every listing is request to book, each partner answers within a day,
// and nothing is paid in the app yet (BOOKING_STATE).
const STEPS = [
  { title: "Pick your dates", body: "Once for the whole trip: everything you add keeps them." },
  { title: "Add from local partners", body: "Stays, tours, rides and transfers, together in one cart." },
  {
    title: "Send your requests",
    body: `Each partner confirms their part; ${BOOKING_STATE.answer}. Nothing is paid in the app yet.`,
  },
];

// "How booking works" (2026-11-08): three numbered steps on the home's white sheet, so a guest
// knows a request isn't a booking before they start. One column on a phone, three from sm.
export function HomeSteps() {
  return (
    <section aria-labelledby="home-steps" className="flex flex-col gap-block border-t border-line pt-6 sm:pt-7">
      <h2 id="home-steps" className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        How booking works
      </h2>
      <ol className="grid gap-5 sm:grid-cols-3 sm:gap-gutter">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3.5">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-action-tint font-display font-extrabold text-action-ink"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="font-display text-title-sm leading-snug font-extrabold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-pretty text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// The sheet's last word (2026-11-08): the hero's main way in again, on a navy card, so the page
// ends on planning instead of trailing off.
export function HomeClosing() {
  return (
    <section
      aria-labelledby="home-closing"
      className="flex flex-col items-start gap-4 rounded-card bg-navy p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-card"
    >
      <div className="flex flex-col gap-1">
        <h2 id="home-closing" className="font-display text-xl font-extrabold tracking-tight text-balance">
          Ready to plan {LAUNCH_AREA.name}?
        </h2>
        <p className="text-pretty text-sky-mist">A guide builds the whole trip with you. Planning is free.</p>
      </div>
      <HomePlanButton testId="home-closing-plan" className="shrink-0 max-sm:w-full" />
    </section>
  );
}
