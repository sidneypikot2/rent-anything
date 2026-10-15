---
paths:
  - "backend/app/models/booking.rb"
  - "backend/app/models/listing_day.rb"
  - "backend/app/models/availability_block.rb"
  - "backend/app/services/availability/**"
  - "backend/app/services/bookings/**"
  - "backend/app/services/stays/quote.rb"
  - "backend/app/controllers/api/v1/partner/calendar_controller.rb"
  - "backend/app/controllers/api/v1/partner/calendar_days_controller.rb"
  - "backend/app/controllers/api/v1/partner/availability_blocks_controller.rb"
  - "backend/app/controllers/api/v1/partner/bookings_controller.rb"
  - "backend/app/serializers/partner_calendar_serializer.rb"
---

# Bookings and the partner calendar (RAA-118)

**One source of truth for a day**: `Availability::Ledger`. It reads a listing's `listing_days`, `availability_blocks` and confirmed `bookings` for a window in one query per table, and answers each day's price, units on sale, booked, units left, minimum nights and block. Anything that asks "can this be had, and at what price" goes through it — the calendar, offline bookings, `Stays::Quote`, and checkout in M4. Don't recount bookings anywhere else.

**Capacity** is a tour's `max_groups_per_day`, otherwise the listing's unit count. A day's `units_available` can lower it, never raise it. A booking takes `quantity` units (a tour's groups), not particular units: SPEC.md's EXCLUDE per unit and `tstzrange` period is M4's. Until then, **every write that can take or give back capacity locks the listing row first** (`listing.lock!` inside the transaction) and checks through a fresh `Ledger`: `Bookings::CreateOffline`, `Availability::SetDays` (units below booked), `Availability::SaveBlock`, and `ListingValues#save_units!` (units below the most booked on any day from today).

**Days a booking takes**: a stay's `starts_on`/`ends_on` are check-in and check-out, so it takes the nights `starts_on...ends_on`; any other booking takes `starts_on..ends_on`. Use `Booking.days_for` / `Booking#days`, never the raw range.

**Per-day changes** (`listing_days`): a null column means the listing's own value. Sending a key as null resets it; leaving it out keeps it. A row with nothing of its own left is deleted (a CHECK refuses an empty row), so a reset that would empty a row deletes it instead of updating it.

**Blocks** never overlap (EXCLUDE constraint, checked first in Ruby for a readable 422). Blocking days that already have bookings is allowed: the bookings stay and only new ones are refused.

**Bookings** are `confirmed` or `cancelled` (Postgres enum `booking_status`), from `offline` (the partner, with the total the guest paid them) or `checkout` (M4). Only cancelling is offered. A listing with any booking, cancelled ones included, can't be deleted: it is delisted instead. Money is `total_cents`. Commission and the price breakdown snapshot come with checkout.

**Not here yet**: checkout and guest-made bookings, the full lifecycle in SPEC.md (requested → … → payout_released, `booking_events`), lowering a tour's `max_groups_per_day` below what is booked, rentals' and transfers' prices, and iCal sync.
