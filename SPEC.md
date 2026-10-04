# Rent-Anything — product and domain design

What this file is: the design decisions and their reasons, and the design for what is not
built yet. What exists is in `backend/config/routes.rb`, `backend/db/schema.rb` and
`backend/swagger/v1/openapi.yaml`. When a section here gets built, delete it from "Not
built" (`script/check-docs` flags a route listed there that `routes.rb` already has).

## The product

**Goal: make a trip to one area easy.** A traveller picks an area (Moalboal first), finds
the tours and activities, and books whatever makes the stay better — an airport van, a
motorbike or trike, freediving fins and mask, an action cam, a place to stay — in one cart
and one checkout. A trip planner for one area, not a general rental site.

Why this shape: no app in the Philippines combines stays, transport, water gear and
activities in one area-based marketplace. Single-category apps exist (Book2Wheel,
IPROG RentGo for vehicles; Klook/Traveloka for activities; Airbnb/Agoda for stays). The
risk is not competition but having enough listings and trust in one place, so launch in
one area with the categories tourists already search for, prove bookings, then expand.

**Money**: the guest pays everything in-app; the platform keeps a commission per booking
(rate set per category), holds the security deposit, and pays the partner out after the
rental ends. Escrow and payouts go through a licensed gateway — the platform never holds
funds itself.

**Partners** are individuals and small businesses: rental shops, tour operators, van
operators, guesthouses and small resorts. Partners are ID-verified before they can list;
listings are approved by an admin.

## Domain decisions

### Four booking types

Each category has one booking type; it decides how a listing is priced and how
availability works.

| Type | Examples | Priced by | Availability |
|---|---|---|---|
| `rental` | motorbike, trike, fins/mask, action cam, jetski | duration tiers (10 min, 30 min, 1 day, 1 week) | units + time ranges |
| `stay` | guesthouse, resort room | per night, with check-in/out times | units + nightly ranges |
| `activity` | sardine run tour, freediving lesson, island hopping | per person or per group, per slot | slots with a seat capacity |
| `transfer` | airport ↔ hotel van, private car, shared shuttle | fixed per route, per vehicle or per seat | vehicles blocked for pickup time + duration + buffer |

- **Duration tiers** (`pricing_tiers`: `duration_minutes`, `price_cents`) cover everything
  from a jetski's ₱2,500/10 min and ₱5,000/30 min to a motorbike's day rate and a stay's
  night (1440 min). A quote picks the cheapest combination of tiers that covers the period.
- **Units**: one row per physical item or vehicle (`listing_units`), so a shop with five
  pairs of fins is one listing with five units.
- **Transfers** are services, not items. A listing belongs to the area it serves even when
  the route starts outside it (Mactan–Cebu Airport → Moalboal). Routes (`transfer_routes`)
  have an origin, a destination (or "any address in the area"), a price per vehicle or per
  seat, an estimated duration and passenger/luggage limits; the return leg is its own
  route. The booking records pickup time, addresses, passengers, luggage and flight number.
  Shared shuttles run as departures with a seat capacity, like activity slots.
- **Category-specific fields** (plate and OR/CR, helmet included; life vests, guide option,
  weather policy; guest count, amenities; serial number, accessories) live in
  `listings.attrs` (jsonb), validated against the category's `attribute_schema` (JSON
  Schema, `json_schemer`). New categories need no migration.

### No double booking, enforced by the database

Bookings hold a `period tstzrange`. A `EXCLUDE USING gist (listing_unit_id WITH =, period
WITH &&) WHERE (state is active)` constraint makes overlapping bookings of the same unit
impossible even under concurrent checkouts. Activity and shuttle seats are counted under a
row lock on the slot. Partners block dates with `availability_blocks`.

### Three entry points

- `/` is for guests (travellers, signed in or not). A sign-up there creates a **guest**.
- `/partner` is for partners (suppliers). A sign-up there creates a **partner**.
- `/admin` is for the team. Sign-in only; admin accounts are never self-made.
- `partner` and `admin` are reserved: no area may use them as its slug.

### Area-first, with a cart per area

- Every traveller page lives under an area (`/moalboal/...`); the area and optional trip
  dates are in the URL and pre-fill availability and quotes. The area home groups listings
  by trip need: Tours & activities; Getting there & around (transfers, motorbikes, trikes);
  Gear; Stays.
- **One cart per user per area** (`carts`, unique on user + area). A Moalboal cart never
  shows when another area is selected; adding another area's listing is a 422.
- Signed-out travellers keep a cart in `localStorage` per area slug; it merges into the
  server cart on sign-in.
- The cart holds nothing: availability and price are re-quoted at checkout, and changed
  items are flagged.
- **Checkout** creates a `trip` with one booking per item and one payment, split to each
  partner. Instant-book items are held for 15 minutes while payment completes. Request-to-book
  items go out as requests first ("Send requests"), and the traveller pays once partners
  accept — a declined item is never charged.

### Booking lifecycle

`requested → accepted → awaiting_payment → confirmed → in_progress → completed → payout_released`

Instant book starts at `awaiting_payment`. Side states: `declined`, `cancelled`, `expired`
(an unpaid hold times out, via a solid_queue job), `disputed` (freezes the payout),
`refunded`. `in_progress` starts with the pickup checklist (condition photos), `completed`
with the return checklist. One service owns the transitions (plain Ruby, no state-machine
gem) and records each as a `booking_events` row. Prices and the commission rate are
snapshotted on the booking.

### Trust

ID verification (government ID + selfie) before a partner can list; admin approval of
partners and listings; reviews after completion; condition photos at pickup and return;
deposits held in-app; a partner's exact location and contact details are revealed only
after a booking is paid (keeps deals on the platform).

## Integrations (confirm against current docs when the milestone starts)

- **Payments — Xendit (xenPlatform)**: split payments to a sub-account per partner,
  GCash/Maya/cards, disbursements to GCash and banks. Webhooks are idempotent, keyed by the
  gateway's event id. E-wallets can't authorise-and-hold, so the deposit is charged and
  refunded after a clean return. PayMongo is the fallback if xenPlatform onboarding
  (business registration) blocks.
- **Phone OTP**: an SMS provider behind `Sms::Sender` (Semaphore or Twilio Verify; chosen at M1).
- **Maps**: MapLibre GL with MapTiler tiles on the web; search is PostGIS on the API.
  Partners drop a pin rather than geocoding an address.
- **Files**: Active Storage on S3-compatible storage (Cloudflare R2). ID documents in a
  private bucket, reachable only through short-lived signed URLs for admins.
- **Chat**: Action Cable over Redis, one conversation per listing + guest.

## Roadmap

| # | Milestone | Contents |
|---|---|---|
| M0 | Foundation | Monorepo, Docker stack, API contract, CI, Claude workflow |
| M1 | Auth & accounts | Email/password, phone OTP, JWT access + refresh tokens, roles (guest, partner, admin), profile |
| M2 | Areas, categories, listings | Listing CRUD, photos, attrs schema, pricing tiers, PostGIS search, area home (map + list), listing page |
| M3 | Availability & quotes | Units, blocks, activity slots, transfer routes, the exclusion constraint, quotes, partner calendar |
| M4 | Cart, booking & payments | Per-area cart (server + signed-out cart merge), trip checkout, booking lifecycle, Xendit split payment + webhooks, commission, deposit, cancellation policies, payouts |
| M5 | Trust | ID verification + admin review, listing approval, reviews, contact masking |
| M6 | Chat | Conversations per listing/booking |
| M7 | Operations | Pickup/return checklists with photos, disputes, admin console |
| M8 | Launch | 30–50 Moalboal listings seeded, production host, monitoring, terms reviewed by a lawyer |

Later, once the first area has steady bookings: curated bundles, delivery by riders, a
damage-protection partner, more categories (cars, boats, camping, event gear), more areas
and English/Filipino/Cebuano, partner tools (dynamic pricing, fleets, analytics), iCal sync
for stays, loyalty and referrals.

## Not built: API routes

Planned shape; the route tables below are checked against `routes.rb`.

| Route | Purpose |
|---|---|
| `/api/v1/registrations` | sign up (email + password, phone) |
| `/api/v1/sessions` | sign in; returns access + refresh tokens |
| `/api/v1/otp_verifications` | verify the phone OTP |
| `/api/v1/areas` | list areas; `/api/v1/areas/:slug` with its categories |
| `/api/v1/listings` | search (area, category, bounding box, dates) and show |
| `/api/v1/quotes` | price and availability for a listing and period |
| `/api/v1/areas/:slug/cart` | the signed-in user's cart for that area, and its items |
| `/api/v1/checkouts` | turn a cart into a trip, bookings and a payment |
| `/api/v1/bookings` | a guest's bookings; partner accept/decline |
| `/api/v1/partner/listings` | a partner's listings, units, calendar and routes |
| `/api/v1/kyc_submissions` | ID + selfie upload |
| `/api/v1/webhooks/xendit` | payment and payout events |
| `/api/v1/admin/listings` | approval queue, commission per category, disputes |
