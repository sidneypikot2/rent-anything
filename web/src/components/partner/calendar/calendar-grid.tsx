"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { CategoryGlyph } from "@/components/discovery/tag-glyphs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { formatPeso } from "@/lib/money";
import { isPendingBooking, type CalendarBlock, type CalendarBooking, type CalendarDay, type CalendarListing } from "../use-partner-calendar";
import {
  bookingSpan,
  dayOfMonth,
  daysBetween,
  isWeekend,
  monthShort,
  monthYear,
  rentalMoment,
  rentalTime,
  shortDate,
  weekdayLetter,
} from "./calendar-dates";

// The day column's width in pixels (w-19), which the bars and the scroll position are worked
// out from. The listing column is narrower on a phone (w-32, sm:w-56), so it is measured.
const DAY_W = 76;

export type Selection = { listing: CalendarListing; from: string; to: string };

type Props = {
  listings: CalendarListing[];
  today: string;
  onSelect: (selection: Selection) => void;
  onBooking: (listing: CalendarListing, booking: CalendarBooking) => void;
  onBlock: (listing: CalendarListing, block: CalendarBlock) => void;
  onJoinerDay: (listing: CalendarListing, date: string) => void;
  loadEarlier: () => void;
  loadLater: () => void;
};

type Drag = { listingId: number; anchor: number; end: number };

// The partner's listings down the side and their days across (RAA-120), like Airbnb's
// multi-calendar: it opens on today and loads more days as either edge comes near. Drag
// across one row to select days; on touch or with a keyboard, pick the first day and then
// the last. Bookings are bars over their days; a joiner tour fills seat by seat instead.
export function CalendarGrid({ listings, today, onSelect, onBooking, onBlock, onJoinerDay, loadEarlier, loadLater }: Props) {
  const dates = listings[0].days.map((day) => day.date);
  const first = dates[0];
  const scroller = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(monthYear(today));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [tapped, setTapped] = useState<{ listingId: number; index: number } | null>(null);
  const shownFirst = useRef<string | null>(null);
  const corner = useRef<HTMLDivElement>(null);

  // Open on today, one day in from the left; when earlier days are put in front, keep the
  // same days in view.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (shownFirst.current === null) element.scrollLeft = (daysBetween(first, today) - 1) * DAY_W;
    else if (shownFirst.current !== first) element.scrollLeft += daysBetween(first, shownFirst.current) * DAY_W;
    shownFirst.current = first;
  }, [first, today]);

  const edges = useRef({ loadEarlier, loadLater });
  useEffect(() => {
    edges.current = { loadEarlier, loadLater };
  });
  const earlierEdge = useRef<HTMLDivElement>(null);
  const laterEdge = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === earlierEdge.current) edges.current.loadEarlier();
          if (entry.target === laterEdge.current) edges.current.loadLater();
        }
      },
      { root: scroller.current, rootMargin: `0px ${DAY_W * 7}px` },
    );
    if (earlierEdge.current) observer.observe(earlierEdge.current);
    if (laterEdge.current) observer.observe(laterEdge.current);
    return () => observer.disconnect();
  }, []);

  function onScroll() {
    const element = scroller.current;
    if (!element) return;
    const middle = Math.floor((element.scrollLeft + (element.clientWidth - (corner.current?.offsetWidth ?? 0)) / 2) / DAY_W);
    const date = dates[Math.min(Math.max(middle, 0), dates.length - 1)];
    if (date) setMonth(monthYear(date));
  }

  function scrollToToday() {
    scroller.current?.scrollTo({ left: (daysBetween(first, today) - 1) * DAY_W, behavior: "smooth" });
  }

  // A mouse drags; the release opens the sheet for the days it crossed.
  useEffect(() => {
    if (!drag) return;
    const finish = () => {
      const listing = listings.find((item) => item.id === drag.listingId);
      setDrag(null);
      if (!listing) return;
      const [a, b] = [Math.min(drag.anchor, drag.end), Math.max(drag.anchor, drag.end)];
      if (a === b && isJoinerDayBooked(listing, listing.days[a])) onJoinerDay(listing, listing.days[a].date);
      else onSelect({ listing, from: listing.days[a].date, to: listing.days[b].date });
    };
    window.addEventListener("pointerup", finish);
    return () => window.removeEventListener("pointerup", finish);
  }, [drag, listings, onJoinerDay, onSelect]);

  function onDayPointerDown(event: PointerEvent, listing: CalendarListing, index: number) {
    const day = listing.days[index];
    if (event.pointerType !== "mouse" || event.button !== 0 || day.date < today || day.block_id) return;
    event.preventDefault();
    setTapped(null);
    setDrag({ listingId: listing.id, anchor: index, end: index });
  }

  function onDayPointerEnter(listing: CalendarListing, index: number) {
    if (!drag || drag.listingId !== listing.id || listing.days[index].date < today) return;
    setDrag({ ...drag, end: index });
  }

  // Touch and keyboard: the first tap marks a day, the second (on the same row) the last.
  // A mouse click arrives here too, already handled by the drag.
  function onDayClick(pointerType: string, listing: CalendarListing, index: number) {
    const day = listing.days[index];
    if (day.block_id) {
      const block = listing.blocks.find((item) => item.id === day.block_id);
      if (block) onBlock(listing, block);
      return;
    }
    if (pointerType === "mouse") return;
    if (day.date < today) {
      if (isJoinerDayBooked(listing, day)) onJoinerDay(listing, day.date);
      return;
    }
    if (!tapped || tapped.listingId !== listing.id) {
      if (isJoinerDayBooked(listing, day)) onJoinerDay(listing, day.date);
      else setTapped({ listingId: listing.id, index });
      return;
    }
    const [a, b] = [Math.min(tapped.index, index), Math.max(tapped.index, index)];
    setTapped(null);
    onSelect({ listing, from: listing.days[a].date, to: listing.days[b].date });
  }

  function selected(listing: CalendarListing, index: number) {
    if (drag?.listingId === listing.id) {
      return index >= Math.min(drag.anchor, drag.end) && index <= Math.max(drag.anchor, drag.end);
    }
    return tapped?.listingId === listing.id && tapped.index === index;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="soft" size="sm" onClick={scrollToToday} data-testid="calendar-today">
          Today
        </Button>
        <p className="font-display text-xl font-extrabold tracking-tight" aria-live="polite">
          {month}
        </p>
        <Legend />
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {tapped
          ? "Now tap the last day, on the same row."
          : "Drag across days on one row to block, price or book them. On a phone, tap the first day, then the last."}
      </p>

      <div
        ref={scroller}
        onScroll={onScroll}
        data-testid="calendar-grid"
        className="card-edge max-h-[70dvh] overflow-auto overscroll-x-contain rounded-card bg-surface shadow-soft select-none"
      >
        <div className="relative w-max">
          <div className="sticky top-0 z-20 flex border-b border-line bg-surface">
            <div ref={corner} className="sticky left-0 z-10 flex w-32 shrink-0 items-center border-r border-line bg-surface px-3 font-display text-sm font-extrabold sm:w-56 sm:px-4 sm:text-base">
              {listings.length} {listings.length === 1 ? "listing" : "listings"}
            </div>
            <div className="relative flex">
              <div ref={earlierEdge} className="absolute inset-y-0 left-0 w-px" aria-hidden />
              {dates.map((date) => (
                <DayHeading key={date} date={date} today={today} />
              ))}
              <div ref={laterEdge} className="absolute inset-y-0 right-0 w-px" aria-hidden />
            </div>
          </div>

          {listings.map((listing, row) => {
            const previous = listings[row - 1];
            const newBusiness = previous?.business.id !== listing.business.id;
            const newCategory = newBusiness || previous?.category.id !== listing.category.id;
            return (
              <Fragment key={listing.id}>
                {newBusiness && (
                  <GroupHeading className="pt-4 font-display text-base font-extrabold tracking-tight">
                    {listing.business.name}
                  </GroupHeading>
                )}
                {newCategory && (
                  <GroupHeading className="pb-1.5 text-xs font-semibold text-muted">{listing.category.name}</GroupHeading>
                )}
                <div className="flex" data-testid="calendar-row">
                  <ListingLabel listing={listing} />
                  <div className="relative flex">
                    {listing.days.map((day, index) => (
                      <DayCell
                        key={day.date}
                        listing={listing}
                        day={day}
                        today={today}
                        selected={selected(listing, index)}
                        blockStart={day.block_id !== null && listing.days[index - 1]?.block_id !== day.block_id}
                        onPointerDown={(event) => onDayPointerDown(event, listing, index)}
                        onPointerEnter={() => onDayPointerEnter(listing, index)}
                        onClick={(pointerType) => onDayClick(pointerType, listing, index)}
                      />
                    ))}
                    {listing.capacity_unit !== "seats" &&
                      listing.bookings.map((booking) => (
                        <BookingBar
                          key={booking.id}
                          listing={listing}
                          booking={booking}
                          first={first}
                          today={today}
                          onClick={() => onBooking(listing, booking)}
                        />
                      ))}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function isJoinerDayBooked(listing: CalendarListing, day: CalendarDay) {
  return listing.capacity_unit === "seats" && day.booked > 0;
}

function GroupHeading({ className, children }: { className: string; children: string }) {
  return (
    <div className="border-b border-line bg-surface-2">
      <p className={cn("sticky left-0 w-max px-4", className)}>{children}</p>
    </div>
  );
}

function DayHeading({ date, today }: { date: string; today: string }) {
  const isToday = date === today;
  const firstOfMonth = dayOfMonth(date) === 1;
  return (
    <div
      className={cn(
        "flex h-14 w-19 shrink-0 flex-col items-center justify-center border-r border-line text-center",
        firstOfMonth && "border-l-2 border-l-line-strong",
        date < today ? "bg-surface-2 text-muted" : isWeekend(date) && "bg-mist",
      )}
    >
      <span className={cn("text-[0.6875rem] font-semibold", isToday ? "text-primary" : "text-muted")}>
        {firstOfMonth && `${monthShort(date)} · `}
        {weekdayLetter(date)}
      </span>
      <span
        className={cn(
          "mt-0.5 font-display text-control font-extrabold",
          isToday && "rounded-control bg-primary px-2 text-white",
        )}
        aria-current={isToday ? "date" : undefined}
      >
        {dayOfMonth(date)}
      </span>
    </div>
  );
}

function capacityText(listing: CalendarListing) {
  const n = listing.capacity;
  if (listing.capacity_unit === "seats") return `Up to ${n} joiners a day`;
  if (listing.capacity_unit === "groups") return `${n} ${n === 1 ? "group" : "groups"} a day`;
  return `${n} ${n === 1 ? "unit" : "units"}`;
}

const STATUS_LABELS: Record<CalendarListing["status"], string> = {
  draft: "Draft",
  active: "Live",
  paused: "Paused",
  delisted: "Delisted",
};

function ListingLabel({ listing }: { listing: CalendarListing }) {
  const live = listing.status === "active";
  return (
    <div className="sticky left-0 z-10 flex h-18 w-32 shrink-0 items-center gap-3 border-r border-b border-line bg-surface px-3 sm:w-56">
      <span className="hidden size-10 shrink-0 sm:flex items-center justify-center rounded-control bg-mist text-primary">
        <CategoryGlyph name={listing.category.name} className="size-5" />
      </span>
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-semibold", !live && "text-muted")} title={listing.title}>
          {listing.title}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-muted">
          {listing.tour_type === "joiner" && (
            <Badge tone="aqua" className="min-h-5 px-2 text-[0.6875rem]" data-testid="joiner-badge">
              Joiner
            </Badge>
          )}
          {listing.tour_type === "private" && (
            <Badge tone="emerald" className="min-h-5 px-2 text-[0.6875rem]">
              Private
            </Badge>
          )}
          {!live && (
            <Badge tone="warning" className="min-h-5 px-2 text-[0.6875rem]">
              {STATUS_LABELS[listing.status]}
            </Badge>
          )}
          <span className="truncate">{capacityText(listing)}</span>
        </div>
      </div>
    </div>
  );
}

type DayCellProps = {
  listing: CalendarListing;
  day: CalendarDay;
  today: string;
  selected: boolean;
  blockStart: boolean;
  onPointerDown: (event: PointerEvent) => void;
  onPointerEnter: () => void;
  onClick: (pointerType: string) => void;
};

function DayCell({ listing, day, today, selected, blockStart, onPointerDown, onPointerEnter, onClick }: DayCellProps) {
  const past = day.date < today;
  const blocked = day.block_id !== null;
  const seats = listing.capacity_unit === "seats";
  const full = !blocked && day.units_left === 0;
  const block = blocked ? listing.blocks.find((item) => item.id === day.block_id) : undefined;
  const pointerType = useRef("");

  return (
    <button
      type="button"
      data-testid="calendar-day"
      aria-pressed={selected}
      aria-label={`${listing.title}, ${shortDate(day.date)}: ${dayStatus(listing, day)}`}
      onPointerDown={(event) => {
        pointerType.current = event.pointerType;
        onPointerDown(event);
      }}
      onPointerEnter={onPointerEnter}
      onClick={() => {
        onClick(pointerType.current);
        pointerType.current = "";
      }}
      className={cn(
        "relative flex h-18 w-19 shrink-0 flex-col border-r border-b border-line px-1.5 pt-1.5 text-left text-xs transition-colors duration-300 ease-calm",
        "focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary",
        past ? "cursor-default bg-surface-2 text-muted" : "cursor-pointer hover:bg-mist",
        blocked && "bg-hatch",
        full && !past && "bg-danger-tint",
        dayOfMonth(day.date) === 1 && "border-l-2 border-l-line-strong",
        selected && "bg-aqua ring-2 ring-primary ring-inset",
      )}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className={cn("text-[0.625rem]", day.min_nights_set ? "font-bold text-primary" : "text-muted")}>
          {day.min_nights !== null && (day.min_nights_set || day.min_nights > 1) && `${day.min_nights}n min`}
        </span>
        <span className={cn(day.price_set ? "font-extrabold text-primary" : "font-medium", past && "text-muted")}>
          {day.price_cents === null ? <span className="text-muted">—</span> : formatPeso(day.price_cents)}
        </span>
      </span>
      <span className="mt-1 text-[0.6875rem] leading-tight">
        <DayNote listing={listing} day={day} blockReason={blockStart ? (block?.reason ?? "") : null} />
      </span>
      {!blocked && <ReturnsNote listing={listing} date={day.date} />}
      {seats && !blocked && day.units_available > 0 && (
        <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-sky-mist" aria-hidden>
          <span
            className={cn("block h-full rounded-full", full ? "bg-danger" : "bg-sky-deep")}
            style={{ width: `${Math.round((day.booked / day.units_available) * 100)}%` }}
          />
        </span>
      )}
    </button>
  );
}

function DayNote({ listing, day, blockReason }: { listing: CalendarListing; day: CalendarDay; blockReason: string | null }) {
  if (day.block_id !== null) {
    return blockReason === null ? null : <span className="font-semibold text-muted">{blockReason || "Blocked"}</span>;
  }
  if (day.units_available === 0) return <span className="font-semibold text-danger">Not on sale</span>;
  if (listing.capacity_unit === "seats") {
    if (day.units_left === 0) return <span className="font-semibold text-danger">Full</span>;
    return (
      <span className={cn("font-semibold text-sky-deep", day.units_set && "text-primary")}>
        {day.booked > 0 ? `${day.booked}/${day.units_available} joined` : `${day.units_available} seats`}
      </span>
    );
  }
  if (day.units_left === 0) return <span className="font-semibold text-danger">Sold out</span>;
  if (listing.capacity <= 1) return null;
  return (
    <span className={day.units_set ? "font-bold text-primary" : "text-muted"}>
      {day.units_left}/{day.units_available} left
    </span>
  );
}

// A vehicle rental's return day (RAA-195): when the last vehicle back that day is ready for the
// next guest, its turnaround after the return, as the API counts it: "Ready 9:00 AM", "2 ready 9:00 AM".
function ReturnsNote({ listing, date }: { listing: CalendarListing; date: string }) {
  const turnaround = (listing.turnaround_minutes ?? 0) * 60_000;
  const ready = listing.bookings
    .filter((booking) => booking.ends_at)
    .map((booking) => ({ at: new Date(new Date(booking.ends_at!).getTime() + turnaround).toISOString(), quantity: booking.quantity }))
    .filter((back) => rentalMoment(back.at).date === date);
  if (ready.length === 0) return null;
  const last = ready.reduce((latest, back) => (back.at > latest ? back.at : latest), ready[0].at);
  const count = ready.reduce((sum, back) => sum + back.quantity, 0);
  return (
    <span className="mt-0.5 text-[0.625rem] leading-tight font-semibold text-sky-deep" data-testid="calendar-returns">
      {count > 1 ? `${count} ready ` : "Ready "}
      {rentalTime(last)}
    </span>
  );
}

function dayStatus(listing: CalendarListing, day: CalendarDay) {
  const price = day.price_cents === null ? "no price" : formatPeso(day.price_cents);
  if (day.block_id !== null) return `blocked, ${price}`;
  if (listing.capacity_unit === "seats") return `${day.booked} of ${day.units_available} seats taken, ${price}`;
  return `${day.units_left} of ${day.units_available} left, ${price}`;
}

function BookingBar({
  listing,
  booking,
  first,
  today,
  onClick,
}: {
  listing: CalendarListing;
  booking: CalendarBooking;
  first: string;
  today: string;
  onClick: () => void;
}) {
  const stay = listing.category.booking_type === "stay";
  const span = bookingSpan(stay, booking.starts_on, booking.ends_on);
  // A stay's bar runs from the middle of check-in to the middle of check-out, as on Airbnb; a
  // vehicle rental's from its pickup to its return, at their hours (RAA-195).
  const pickup = booking.starts_at ? rentalMoment(booking.starts_at) : null;
  const back = booking.ends_at ? rentalMoment(booking.ends_at) : null;
  const start = pickup ? daysBetween(first, pickup.date) + pickup.fraction : daysBetween(first, span.first) + (stay ? 0.5 : 0);
  const end = back ? daysBetween(first, back.date) + back.fraction : start + span.count;
  const left = start * DAY_W + 3;
  const width = Math.max((end - start) * DAY_W - 6, 24);
  const over = booking.ends_on < today;
  const pending = isPendingBooking(booking);
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
      data-testid="calendar-booking"
      style={{ left, width }}
      className={cn(
        "absolute bottom-1.5 z-[1] h-6 truncate rounded-full px-2.5 text-left text-[0.6875rem] leading-6 font-semibold shadow-soft",
        "transition-transform duration-300 ease-calm motion-safe:hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-primary",
        pending ? "border border-dashed border-navy/40 bg-aqua text-navy" : over ? "bg-muted text-white" : "bg-emerald text-white",
      )}
    >
      {booking.status === "requested" && "Request · "}
      {booking.starts_at && booking.ends_at && `${rentalTime(booking.starts_at)}–${rentalTime(booking.ends_at)} · `}
      {booking.guest_name}
      {booking.quantity > 1 && ` ×${booking.quantity}`} · {formatPeso(booking.total_cents)}
    </button>
  );
}

function Legend() {
  return (
    <ul className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-6 rounded-full bg-emerald" /> Booking
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-6 rounded-full border border-dashed border-navy/40 bg-aqua" /> Pending
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-1.5 w-6 overflow-hidden rounded-full bg-sky-mist">
          <span className="block h-full w-1/2 bg-sky-deep" />
        </span>
        Joiner seats
      </li>
      <li className="flex items-center gap-1.5">
        <span className="font-extrabold text-primary">₱</span> Set for the day
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3.5 rounded-sm border border-line bg-hatch" /> Blocked
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3.5 rounded-sm border border-line bg-danger-tint" /> Full
      </li>
    </ul>
  );
}
