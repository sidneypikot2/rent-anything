import type { BusinessDetail } from "@/api/discovery";
import { FeatureGlyph } from "@/components/discovery/tag-glyphs";
import { HOUSE_RULE_LABELS, LANGUAGE_LABELS, listText, WEEKDAYS } from "@/components/listings/business-labels";
import { STAY_LABELS } from "@/components/listings/stay-labels";
import { VEHICLE_AMENITY_LABELS } from "@/components/listings/vehicle-labels";
import { timeText } from "@/lib/times";
import { Section } from "@/components/ui/section";
import { formatPeso } from "@/lib/money";
import { INCLUSION_LABELS, type InclusionKind } from "@/lib/tours";

// The parts of a business's shop page (RAA-281) built from what its partner tells guests and what
// its listings share: the trust strip under the photos, what comes with everything it offers,
// and Good to know. Server-rendered; the map is BusinessMapLoader's.

type Business = BusinessDetail["business"];
type Listing = BusinessDetail["listings"][number];
type Fact = { icon: string; title: string; note?: string };

const FREE_CANCELLATION: Record<string, string> = {
  free_cancellation: "anytime before it starts",
  seven_days: "up to 7 days before",
  fourteen_days: "up to 14 days before",
};

export function hoursText(hours: NonNullable<Business["hours"]>) {
  return `${timeText(hours.opens_at)} – ${timeText(hours.closes_at)}`;
}

export function closedText(days: number[]) {
  return days.length ? `Closed ${listText(days.map((day) => `${WEEKDAYS[day]}s`))}` : "Open every day";
}

const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

// What every listing in `listings` has, in the first one's order.
function shared(listings: Listing[], of: (listing: Listing) => string[]) {
  if (listings.length === 0) return [];
  return of(listings[0]).filter((item) => listings.every((listing) => of(listing).includes(item)));
}

// Up to four facts a guest weighs first, for the kind of thing it leads with (`lead`, its first
// group): its cancellation when all its listings share one, then what that kind cares about.
export function shopFacts(business: Business, listings: Listing[], lead: Listing["group"]): Fact[] {
  const facts: Fact[] = [];
  const policies = new Set(listings.map((listing) => listing.cancellation_policy));
  const policy = policies.size === 1 ? FREE_CANCELLATION[[...policies][0]] : undefined;
  if (policy) facts.push({ icon: "cancellation", title: "Free cancellation", note: policy });

  if (lead === "rental" || lead === "gear") {
    const deposits = listings.map((listing) => listing.handover?.deposit_cents).filter((cents): cents is number => !!cents);
    if (deposits.length) facts.push({ icon: "amenity", title: `${formatPeso(Math.min(...deposits))} deposit`, note: "Back when you return it" });
    const fees = listings.map((listing) => listing.handover?.delivery_fee_cents).filter((cents): cents is number => cents != null);
    if (fees.length) facts.push({ icon: "route", title: fees.includes(0) ? "Free delivery" : "Delivers to you", note: "Or pick it up at the shop" });
  }
  if (lead === "stay" && business.host) facts.push({ icon: "guests", title: `Hosted by ${business.host.name}`, note: business.host.intro ?? undefined });
  if (lead === "stay" && business.stay_rules?.check_in_from) {
    facts.push({ icon: "clock", title: `Check-in from ${timeText(business.stay_rules.check_in_from)}`, note: business.stay_rules.check_out_by ? `Check-out by ${timeText(business.stay_rules.check_out_by)}` : undefined });
  }
  if (business.languages.length) {
    facts.push({ icon: "guide", title: "Speaks", note: listText(business.languages.map((code) => LANGUAGE_LABELS[code] ?? code)) });
  }
  if (business.hours) facts.push({ icon: "clock", title: `Open ${hoursText(business.hours)}`, note: closedText(business.hours.closed_days) });
  return facts.slice(0, 4);
}

export function BusinessTrust({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 max-sm:px-3 lg:grid-cols-4" data-testid="business-trust">
      {facts.map((fact) => (
        <li key={fact.title} className="flex min-w-0 items-start gap-3 rounded-control bg-surface-2 p-3">
          <FeatureGlyph name={fact.icon} className="mt-0.5 size-5 shrink-0 text-emerald" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-snug">{fact.title}</span>
            {fact.note && <span className="block text-small leading-snug text-muted">{fact.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

type IncludedGroup = { title: string; items: string[] };

// What comes with everything it offers, per kind: motorbikes and cars apart, since they come with
// different things; the inclusions every tour shares, and what each one leaves out; the amenities
// every stay has. Only what all of a kind share: the rest shows on each option.
export function includedGroups(listings: Listing[]): { groups: IncludedGroup[]; notIncluded: [string, string][] } {
  const groups: IncludedGroup[] = [];
  const rentals = listings.filter((listing) => listing.group === "rental");
  const motorbikes = rentals.filter((listing) => /motor/i.test(listing.category));
  const cars = rentals.filter((listing) => !/motor/i.test(listing.category));
  const vehicleAmenities = (listing: Listing) => strings(listing.details.amenities);
  for (const [title, kind] of [["With every motorbike", motorbikes], ["With every car", cars]] as const) {
    const items = shared(kind, vehicleAmenities).map((amenity) => VEHICLE_AMENITY_LABELS[amenity] ?? amenity);
    if (items.length) groups.push({ title, items });
  }

  const tours = listings.filter((listing) => listing.tour);
  const tourKinds = shared(tours, (listing) => listing.tour?.inclusions ?? []);
  const guide = tours.length > 0 && tours.every((listing) => listing.details.guide_included === true);
  const tourItems = [...(guide && !tourKinds.includes("guide") ? ["Guide"] : []), ...tourKinds.map((kind) => INCLUSION_LABELS[kind as InclusionKind] ?? kind)];
  if (tourItems.length) groups.push({ title: tours.length > 1 ? "On every tour" : "On the tour", items: tourItems });
  const notIncluded = tours.flatMap((listing): [string, string][] => (listing.tour?.not_included ? [[listing.title, listing.tour.not_included]] : []));

  const stays = listings.filter((listing) => listing.group === "stay");
  const stayItems = shared(stays, (listing) => strings(listing.details.amenities)).map((amenity) => STAY_LABELS[amenity] ?? amenity);
  if (stayItems.length) groups.push({ title: stays.length > 1 ? "In every room" : "In the room", items: stayItems });

  return { groups, notIncluded };
}

export function BusinessIncluded({ listings }: { listings: Listing[] }) {
  const { groups, notIncluded } = includedGroups(listings);
  if (groups.length === 0 && notIncluded.length === 0) return null;
  return (
    <Section title="What's included" className="max-sm:px-3" testId="business-included">
      <div className="grid gap-6 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-3">
            {groups.length > 1 && <h3 className="text-sm font-semibold text-muted">{group.title}</h3>}
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {group.items.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <FeatureGlyph name="amenity" className="mt-0.5 size-4 shrink-0 text-emerald" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {notIncluded.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted">Not included</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {notIncluded.map(([title, text]) => (
                <li key={title}>
                  {notIncluded.length > 1 && <span className="font-semibold">{title}: </span>}
                  {text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}

// Questions and answers, then the stay rules and hours, each a disclosure that opens in place;
// the first one open. Nothing when the partner has said none of it.
export function BusinessGoodToKnow({ business }: { business: Business }) {
  const items: { question: string; answer: string }[] = [...business.faqs];
  const rules = business.stay_rules;
  if (rules) {
    const lines = [
      rules.check_in_from &&
        `Check in from ${timeText(rules.check_in_from)}${rules.check_in_until ? ` until ${timeText(rules.check_in_until)}` : ""}.`,
      rules.check_out_by && `Check out by ${timeText(rules.check_out_by)}.`,
      ...rules.house_rules.map((rule) =>
        rule === "quiet_hours" && rules.quiet_from ? `Quiet from ${timeText(rules.quiet_from)}.` : `${HOUSE_RULE_LABELS[rule] ?? rule}.`,
      ),
      rules.note,
    ].filter(Boolean);
    if (lines.length) items.push({ question: "House rules", answer: lines.join(" ") });
  }
  if (business.hours) items.push({ question: "Opening hours", answer: `${hoursText(business.hours)}. ${closedText(business.hours.closed_days)}.` });
  if (items.length === 0) return null;

  return (
    <Section title="Good to know" className="max-sm:px-3" testId="business-good-to-know">
      <div className="max-w-prose divide-y divide-line border-y border-line">
        {items.map((item, index) => (
          <details key={item.question} open={index === 0} className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              {item.question}
              <span aria-hidden className="text-muted transition-transform duration-300 ease-calm group-open:rotate-180">
                ▾
              </span>
            </summary>
            <p className="pb-4 text-sm break-words whitespace-pre-line text-muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
