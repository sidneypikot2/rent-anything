---
paths:
  - "backend/app/models/booking.rb"
  - "backend/app/models/booking_event.rb"
  - "backend/app/models/checkout.rb"
  - "backend/app/models/payment.rb"
  - "backend/app/models/listing_day.rb"
  - "backend/app/models/availability_block.rb"
  - "backend/app/services/availability/**"
  - "backend/app/services/bookings.rb"
  - "backend/app/services/bookings/**"
  - "backend/app/services/checkouts/**"
  - "backend/app/services/payments/**"
  - "backend/app/services/stays/quote.rb"
  - "backend/app/jobs/bookings/**"
  - "backend/app/controllers/api/v1/bookings_controller.rb"
  - "backend/app/controllers/api/v1/checkouts_controller.rb"
  - "backend/app/controllers/api/v1/partner/calendar_controller.rb"
  - "backend/app/controllers/api/v1/partner/calendar_days_controller.rb"
  - "backend/app/controllers/api/v1/partner/availability_blocks_controller.rb"
  - "backend/app/controllers/api/v1/partner/bookings_controller.rb"
  - "backend/app/controllers/api/v1/partner/all_bookings_controller.rb"
  - "backend/app/controllers/api/v1/admin/bookings_controller.rb"
  - "backend/app/serializers/admin_booking_serializer.rb"
  - "backend/app/serializers/booking_serializer.rb"
  - "backend/app/serializers/partner_calendar_serializer.rb"
---

# Bookings, checkout and the partner calendar (RAA-118, RAA-132)

**One source of truth for a day**: `Availability::Ledger`. It reads a listing's `listing_days`, `availability_blocks` and the bookings that hold days (`Booking.holding`) for a window in one query per table, and answers each day's price, units on sale, booked, units left, minimum nights and block. Anything that asks "can this be had, and at what price" goes through it — the calendar, offline bookings, `Stays::Quote` and checkout. Don't recount bookings anywhere else.

**Holding**: `Booking::HOLDING` (requested, accepted, awaiting_payment, confirmed, in_progress, completed) take their days; declined, cancelled and expired free them. A request and an unpaid hold count exactly as a confirmed booking does, so a date is never sold twice while one waits.

**Capacity** is a joiner tour's seats (`max_guests × max_groups_per_day`, RAA-119), a private tour's `max_groups_per_day`, otherwise the listing's unit count; `Ledger.capacity_unit` names which (`seats`, `groups`, `units`) and the calendar serves it with `tour_type`. A day's `units_available` can lower it, never raise it. A booking takes `quantity` units (a private tour's groups, a joiner tour's joiners), not particular units, so a joiner day stays bookable until its seats are full: SPEC.md's EXCLUDE per unit and `tstzrange` period is still to come. Until then, **every write that can take or give back capacity locks the listing row first** (`listing.lock!` inside the transaction) and checks through a fresh `Ledger`: `Checkouts::Create`, `Bookings::CreateOffline`, `Availability::SetDays` (units below booked), `Availability::SaveBlock`, and `ListingValues#save_units!` (units below the most booked on any day from today). `spec/services/checkouts/concurrency_spec.rb` holds two real transactions against each other; keep it passing.

**Days a booking takes**: a stay's `starts_on`/`ends_on` are check-in and check-out, so it takes the nights `starts_on...ends_on`; a vehicle rental (RAA-195) runs 24 hours a day from its pickup time, so it takes the days it starts on, like nights (Nov 3 to Nov 5 takes Nov 3 and 4; a single date one day), and its vehicles are free again on the return day; any other booking takes `starts_on..ends_on`. Use `Booking.days_for(listing, …)` / `Booking#days` / `Booking#last_day`, never the raw range — and never `days.last`, which for a stay's exclusive range is the check-out.

**Rental periods** (RAA-195): a vehicle booking keeps `starts_at`/`ends_at` (`Booking.rental_period`, `Listing#rental_period`: the pickup time in the area's time, `Booking::RENTAL_TIME_ZONE`, 9:00 or the shop's first pickup when none was picked; a booking saved without one is given it). A trip item keeps the guest's `pickup_time`. Every check that books or re-dates a rental passes its `period:` to `Ledger#refusal`, which also checks it by the hour: at no moment of the period and its `vehicle_rates.turnaround_minutes` may the vehicles out at once and the new ones exceed the units. Bookings take vehicles by count, never particular ones — peak overlap within the units means they can always be handed out one vehicle each. `GET /listings/:id/price` answers a rental's `pickup_times` (each of the shop's, `pickup_from_hour` to `pickup_until_hour` by the half hour, with whether it is free) and `returns_at`.

**The lifecycle** (SPEC.md, Booking lifecycle): `requested → accepted → awaiting_payment → confirmed → in_progress → completed`, instant book starting at `awaiting_payment`, with `declined`, `cancelled` and `expired` beside them. **`Bookings::Transition` is the only place a status changes**: it locks the booking, refuses a move not in `ALLOWED`, sets the times that go with it and writes a `booking_events` row (actor guest, partner, admin — the team answering for a partner, RAA-141 — or system). A new booking's first status is recorded with `Transition.record_start`. Never `update!(status: ...)` or the enum's bang methods. Add a status by adding it to the Postgres enum (its own migration), `Booking::STATUSES` and `ALLOWED`.

**Checkout** (`Checkouts::Create`, `POST /checkouts`) books a trip's items all or nothing: each is re-priced (`Bookings::Price`: stays by `Stays::Quote` per unit, tours by base price × quantity, a rental vehicle by its daily price for each vehicle and day with its deposit apart, gear and transfers by their `FlatRate` (per item a day, per vehicle a trip, RAA-191), and only a listing still without a price at ₱0 with `to_be_agreed`; `GET /listings/:id/price` (`Bookings::PriceFor`) prices an add the same way for the add sheet) and checked against a fresh `Ledger` after the bookings made before it in the same checkout. A trip item's `quantity` is its guests, except gear's (`Category#gear?`), which is how many: the units they take are `Booking.units_for` (a joiner tour's seats, a private tour's groups, a stay's units by what each sleeps, gear's count, otherwise one), and the booking keeps both (`quantity` units, `guests`; a gear booking has no guests). Adding gear a trip already holds unbooked on the same dates raises that item's quantity (`Trips::AddItem`), up to the listing's units (`max_quantity`), rather than adding a second item. Each booking snapshots its price breakdown, the category's `commission_bps` (and `commission_cents`, rounded half up), the cancellation policy and the booking mode; later changes to the listing never reach it. `idempotency_key` is unique per guest: a repeat returns the first checkout. A trip item has at most one holding booking (a partial unique index).

**Request to book only** (RAA-134): partners can pick only `Listing::OFFERED_BOOKING_MODES` (request), and every listing was moved to it; `instant` stays a mode in the model and checkout so it can come back. `Bookings.auto_accept?` (`BOOKINGS_AUTO_ACCEPT`, off unless `"true"`) would accept requests right after checkout through the same transitions a partner's answer makes; off, they wait for the partner's Accept / Decline in the partner calendar, or the team's in `/admin` (`PATCH /admin/bookings/:id`, RAA-141), both through `Bookings::Respond`. Staging sets it on (`render.yaml`); local stacks and specs leave it off. **Paying** (RAA-143): accepting a request leaves it `awaiting_payment`; nothing pays automatically, at checkout or on an answer. The guest pays from the cart (`POST /bookings/pay`, `Payments::Pay`): all or nothing over their own bookings held for payment. With PayMongo set up they pay on its hosted checkout and are confirmed once it reports the payment; without it, one `Payments::Stub` payment per checkout confirms them at once (`payments.md`). The one exception is a booking already paid (a changed one): when it is accepted again, `Bookings::Respond` confirms it through the stub straight away, with no charge. A hold whose PayMongo checkout is open is kept at least `Payment::CHECKOUT_WINDOW` (`expires_at` is pushed, not its status), and `Bookings::Expire` lets the checkout go (`Payments::Release`) before it expires the booking.

**A guest's change** (`Bookings::Change`, `PATCH /bookings/:id`, RAA-134): new dates or guests for a booking that holds its days and hasn't started — and, as on its trip item, a stay's `room_guests` and `pets`, a vehicle's `pickup_time` and `units` (RAA-200; gear's `guests` is its count, and its booking keeps no guests). It locks the trip, the listing, then the booking, re-prices through `Bookings::Price` and checks a `Ledger` built with `except:` the booking (its own days are free to it; `Stays::Quote` takes the same `except_booking:`), updates its trip item, and sends it back to `requested` (a new request's `expires_at`), never auto-accepted. A booking already paid keeps its payment: accepted, `Payments::Stub` confirms it on that payment without a second charge; declined, `Bookings::Respond` records the whole payment as refunded. The change in price is settled when payments are real.

**Timing**: a request waits `Booking::REQUEST_TTL` (24h) or until its start, an instant hold `Booking::PAYMENT_TTL` (15 min), an accepted request `Booking::ACCEPTED_PAYMENT_TTL` (24h) or until the start of its first day, never less than 15 min (`Transition`), then `Bookings::Expire` (every 5 minutes) expires it. `Bookings::Progress` (daily, 00:15 UTC) starts confirmed bookings on their first day and completes them after `last_day`. Dates are UTC, as everywhere on the calendar.

**Cancelling** (`Bookings::Cancel`): anything not yet under way. A partner's cancel refunds a paid booking in full; a guest's follows the snapshotted policy by date (free until the day before for `free_cancellation`, until 7 / 14 days before for `seven_days` / `fourteen_days`, nothing for `non_refundable`). Nothing paid, nothing refunded; an offline booking records no refund. Refunds are only recorded until payments are real.

**Per-day changes** (`listing_days`): a null column means the listing's own value. Sending a key as null resets it; leaving it out keeps it. A row with nothing of its own left is deleted (a CHECK refuses an empty row), so a reset that would empty a row deletes it instead of updating it.

**Blocks** never overlap (EXCLUDE constraint, checked first in Ruby for a readable 422). Blocking days that already have bookings is allowed: the bookings stay and only new ones are refused.

**Offline bookings** (`Bookings::CreateOffline`) are the partner's, confirmed from the start, with the total the guest paid them. A listing with any booking, cancelled ones included, can't be deleted: it is delisted instead.

**Not here yet**: live payments (PayMongo is in test mode), refunds through PayMongo, payouts (including the difference when a paid booking's change costs more or less), `payout_released`, `disputed` and `refunded`, deposits, the partner inbox (answering requests is `PATCH partner/listings/:id/bookings/:id`), the pickup and return checklists that will start and complete rentals, lowering a tour's `max_groups_per_day` below what is booked, and iCal sync.
