# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A native mobile app comes later, on the same API and OpenAPI contract. Until then the web app is the phone experience.

## Users

**Travellers (guests)**, both Filipino and foreign, mostly on a phone. They plan before they arrive and keep adding things once they are on the island. Their job is to put a whole trip together without hunting down operators one by one: the transfer from Cebu, a scooter for the week, island hopping, snorkel gear, a place to stay.

**Partners**: individuals and small businesses (rental shops, tour and van operators, guesthouses, small resorts). They list what they offer and keep it current. A partner takes their own listing from draft to live once a readiness check passes. There is no admin approval; the team agreed this in October 2026. They use `/partner`, which is kept apart from the traveller site.

**The team (admins)** run the platform from `/admin`. Admins sign in only; there is no admin sign-up.

## Product Purpose

TripKoNext makes a trip easy to put together. A traveller picks where they're going and books tours and activities, airport transfers, motorbikes and trikes, water gear, cameras and stays from local partners, all in one cart. The cart is grouped into trips, and a trip can span several areas. The platform earns a commission on each booking.

Success means bookings in the launch area, enough listings and trust in one place to prove it, and then expansion to more areas.

## Positioning

No app in the Philippines combines stays, transport, water gear and activities in one marketplace organised by area. Others cover one category each: Book2Wheel and IPROG RentGo for vehicles, Klook and Traveloka for activities, Airbnb and Agoda for stays. TripKoNext is a trip planner organised around places, not a general rental site. Its unit is the trip: every stop, date and item together in one cart.

The brand promises the whole Philippines: islands, mountains and cities. **Bantayan Island is the launch area** and gets the depth. Other destinations, such as Cebu City, appear as partners list them.

## Operating Context

- **Area first**: every traveller page lives under an area (`/bantayan-island/...`). The area and the trip dates travel in the URL.
- **The cart is a list of trips**: each trip has a name, dates and guests, and items from any area. Signing in comes before the first add. Later adds suggest a trip by date, then by distance.
- **Four booking types**, one per category, which decide pricing and availability:
  - **rental**: priced in duration tiers
  - **stay**: priced per night
  - **activity**: per person or per group, per slot
  - **transfer**: priced per route
- **Three separate sections**: guest (`/`), partner (`/partner`) and admin (`/admin`). Each has its own sign-in and layout.

## Capabilities and Constraints

- **Built**:
  - accounts and roles
  - areas, landmarks and activities for browsing
  - search
  - listings with photos
  - the tour builder
  - partner ID verification (Didit)
  - the cart of trips (add, move, re-date, merge, cleanup)
  - listers publishing their own listings behind readiness checks
- **Not built yet**:
  - checkout and payment (Xendit split payment, to be designed together with it)
  - the booking lifecycle
  - reviews
  - chat
  - pickup and return checklists
  - payouts

  Until checkout exists, every trip is "Planning" and nothing can be paid.
- **Money (planned)**: the guest pays everything in-app. A licensed gateway handles escrow, deposits and payouts; the platform never holds funds itself.
- **Hosting**: free tiers until launch (M8). Staging is the only hosted environment.
- **Language**: English only for now. Filipino and Cebuano are on the later roadmap.
- **Naming**: TripKoNext is the brand in the web UI only. The repo, API, docs and Jira keep the name Rent-Anything.
- **Open**: the checkout design, cancellation policies, the deposit flow and the production host.

## Brand Commitments

- **Name and tagline**: TripKoNext, "Your Whole Trip in One Cart". In code they always come from `web/src/lib/brand.ts`, never written out. The wordmark has two tones (TripKo + Next).
- Never shorten the name to "Tripko": tripko.com is an existing travel portal.
- **Voice**: plain, concrete and local. The copy names real places and real things to do (island hopping, a scooter for the week, the last boat out) rather than generic travel language. It promises only what is true today.

## Evidence on Hand

- **Real**:
  - seeded Bantayan Island partners and listings, including Santa Fe
  - landmarks and activities with counts from the API
  - listing photos stored on R2
- **Stand-ins**: destination and activity photos are samples (`web/public/images/samples/`, alt text "Sample photo"). Replace them when the API serves real ones.
- **Absent, and never to be invented**:
  - reviews, ratings and testimonials
  - booking or traveller counts
  - partner numbers
  - press
  - prices for payment flows that don't exist yet
  - any statement that payment, booking confirmation or deposits are live

## Product Principles

1. **The trip is the unit.** Every surface helps a traveller see and shape a whole trip, not just a single rental.
2. **Promise only what is true today.** The site can say partners pass an ID check before listing and that saving to a trip is free, with nothing to pay yet. It must not claim admin approval, reviews or payment until they exist. Seed partners who joined before the ID check existed haven't passed it, so never say "every partner".
3. **Local and specific beats generic.** Use real places, real operators and real things to do. Depth in one area comes before breadth.
4. **Phone first.** Most travellers book from a phone, often on the island. The main action belongs on the first screen.
5. **Keep the three sections apart.** Travellers, partners and the team each get their own way in and their own work.

## Accessibility & Inclusion

The target is WCAG AA, with the contrast pairs defined in `.claude/rules/web-ui.md`. Tap targets are at least 44px. `prefers-reduced-motion` turns motion off. The audience mixes native and non-native English readers, so keep the copy short and plain.
