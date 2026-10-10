# Rent-Anything — product and domain design

What this file is: the design decisions and their reasons, and the design for what is not
built yet. What exists is in `backend/config/routes.rb`, `backend/db/schema.rb` and
`backend/swagger/v1/openapi.yaml`. When a section here gets built, delete it from "Not
built" (`script/check-docs` flags a route listed there that `routes.rb` already has).

## The product

**Goal: make a trip to one area easy.** A traveller picks an area (Bantayan Island first), finds
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
  the route starts outside it (Mactan–Cebu Airport → Bantayan Island). Routes (`transfer_routes`)
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

### Area-first browsing, a cart of trips

Agreed by the team in October 2026 ("Trips instead of area carts", decisions 1–15). It
replaces the earlier one-cart-per-area design, because a Bantayan – Malapascua trip spans two
areas and a tour can visit several.

- Every traveller page lives under an area (`/bantayan-island/...`); the area and optional trip
  dates are in the URL and pre-fill availability and quotes. The area home groups listings
  by trip need: Tours & activities; Getting there & around (transfers, motorbikes, trikes);
  Gear; Stays. A listing keeps one area.
- **The cart is a list of the guest's trips** (`trips`: name, dates, guests), each with its
  items (`trip_items`: listing, dates, quantity) from any area, in date order. Built in
  RAA-64. A trip's dates always cover its dated items; adding or re-dating an item extends
  them.
- **Sign-in comes before the first add.** That add then creates a trip named
  `<destination> · <dates>`. The destination is the listing's published island, otherwise its
  town or city, never a province (Santa Fe → Bantayan Island). Signed-out trips are a
  follow-up feature on the same server model.
- **Later adds suggest a trip**, by date first, then by distance. If the item is inside a
  trip's dates, or up to 3 days outside them, it goes to that trip (outside the dates, the
  trip is extended). If it is more than 3 days from every trip, the suggestion is "New trip".
  An undated item goes to the most recently edited trip with the same destination. Items can
  be moved and trips merged.
- Undated items can sit in a trip but can't be checked out until they have a date.
- Cleanup (RAA-65): a daily job shows an in-app notice when a trip ends and deletes its
  unbooked items 7 days later. An undated trip gets the same notice after 60 days with no
  edits. Booked items are never deleted. No email in M4.
- The cart holds nothing: availability and price are re-quoted at checkout, and changed
  items are flagged.
- **Checkout** (not designed yet; to be decided together with Xendit) takes the items the
  guest selects from a trip and creates their bookings and one payment, split to each partner.
  So a trip can have several checkouts, and its status (planning → partly booked → booked)
  follows its items. Instant-book items are held for 15 minutes while payment completes.
  Request-to-book items go out as requests first ("Send requests"), and the traveller pays once
  partners accept, so a declined item is never charged.

### Booking lifecycle

`requested → accepted → awaiting_payment → confirmed → in_progress → completed → payout_released`

Instant book starts at `awaiting_payment`. Side states: `declined`, `cancelled`, `expired`
(an unpaid hold times out, via a solid_queue job), `disputed` (freezes the payout),
`refunded`. `in_progress` starts with the pickup checklist (condition photos), `completed`
with the return checklist. One service owns the transitions (plain Ruby, no state-machine
gem) and records each as a `booking_events` row. Prices and the commission rate are
snapshotted on the booking.

### Trust

ID verification (government ID + selfie, run by Didit) before a partner can add a listing,
with 3 tries and then an hour's wait; admin approval of listings; reviews after completion; condition photos at pickup and return;
deposits held in-app; a partner's exact location and contact details are revealed only
after a booking is paid (keeps deals on the platform).

## Integrations (confirm against current docs when the milestone starts)

- **Payments — Xendit (xenPlatform)**: split payments to a sub-account per partner,
  GCash/Maya/cards, disbursements to GCash and banks. Webhooks are idempotent, keyed by the
  gateway's event id. E-wallets can't authorise-and-hold, so the deposit is charged and
  refunded after a clean return. PayMongo is the fallback if xenPlatform onboarding
  (business registration) blocks.
- **ID verification — Didit**: hosted KYC (ID document, passive liveness, face match), 500
  free checks a month. Didit keeps the images; we keep only the outcome, read back after a
  signed webhook. A sandbox application on staging. Built in RAA-44.
- **Phone OTP** (deferred, no free SMS tier for PH): an SMS provider behind `Sms::Sender`,
  likely Semaphore (about PHP 1 per OTP).
- **Maps**: MapLibre GL JS on the web with OpenFreeMap's vector tiles (free, no key), credited
  to OpenStreetMap on every map; search is PostGIS on the API (RAA-61, replacing Google Maps
  Platform). A partner's address suggests where the pin goes through Photon's public instance
  (OSM-based; self-hosted at M8), and the partner confirms or drags it. OSM is only drawn on the
  map and used for that suggestion; none of its data is imported into the gazetteer.
- **Place data — our own gazetteer** (RAA-59): every region, province, city and town from the
  PSA's PSGC (CC BY), with boundaries from OCHA's COD-AB (CC BY-IGO); islands are cut from
  the same data. Imported by hand each quarter (`backend/db/gazetteer/README.md`), never
  fetched while a guest searches; only free, openly licensed sources — no OpenStreetMap data
  (share-alike), GADM (non-commercial) or paid geocoding. Imported areas are drafts until
  published; a listing's area is the smallest published one whose boundary covers its pin.
- **Files**: Active Storage on S3-compatible storage (Cloudflare R2). ID documents are not
  stored here: Didit holds them.
- **Chat**: Action Cable over Redis, one conversation per listing + guest.

## Roadmap

| # | Milestone | Contents |
|---|---|---|
| M0 | Foundation | Monorepo, Docker stack, API contract, CI, Claude workflow |
| M1 | Auth & accounts | Email/password, phone OTP (deferred), JWT access + refresh tokens, roles (guest, partner, admin), profile |
| M2 | Areas, categories, listings | Listing CRUD, photos, attrs schema, pricing tiers, PostGIS search, area home (map + list), listing page |
| M3 | Availability & quotes | Units, blocks, activity slots, transfer routes, the exclusion constraint, quotes, partner calendar |
| M4 | Cart, booking & payments | Cart of trips (RAA-64 API; RAA-65 trip cleanup job; add-to-trip and cart UI; tour landmark picker), checkout of selected items, booking lifecycle, Xendit split payment + webhooks, commission, deposit, cancellation policies, payouts |
| M5 | Trust | Listing approval (partner ID verification moved earlier: RAA-44, Didit), reviews, contact masking |
| M6 | Chat | Conversations per listing/booking |
| M7 | Operations | Pickup/return checklists with photos, disputes, admin console |
| M8 | Launch | 30–50 Bantayan Island listings seeded, production host, monitoring, terms reviewed by a lawyer |

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
| `/api/v1/otp_verifications` | verify the phone OTP (deferred) |
| `/api/v1/areas` | list areas; `/api/v1/areas/:slug` with its categories |
| `/api/v1/listings` | search (area, category, bounding box, dates) and show |
| `/api/v1/quotes` | price and availability for a listing and period |
| `/api/v1/checkouts` | turn a trip's selected items into bookings and a payment |
| `/api/v1/bookings` | a guest's bookings; partner accept/decline |
| `/api/v1/partner/listings` | a partner's listings, units, calendar and routes |
| `/api/v1/webhooks/xendit` | payment and payout events |
| `/api/v1/admin/listings` | approval queue, commission per category, disputes |
