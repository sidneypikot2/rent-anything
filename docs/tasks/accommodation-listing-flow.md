# Accommodation listing flow

Status: in progress.

## Goal

When a partner adds a listing under **Accommodation**, walk them through a stay-specific
flow instead of the generic wizard (Basic → Location → Details → Rate):

1. **Property type** — Apartment, House, Guest house, Hotel, …, each with a one-line
   explanation so the partner knows which to pick.
2. **What guests book** — Entire place, Private room or Shared room.
3. **Address** — the existing PH address fields and map pin.
4. **Property info** — beds (type and count), max guests, bathrooms.
5. **Amenities** — checkboxes for the common, most-searched amenities.
6. **Photos** — skippable.
7. **Rate** — nightly rate.

Other categories keep the current wizard unchanged.

## What exists today

- Categories form a tree; only leaves have a `booking_type`. Accommodation has one leaf,
  `hotel` ("Hotel or cottage", `stay`), with `attribute_schema`
  `{ guests: integer (required), amenities: array }`
  (`backend/db/migrate/20261006000001_seed_discovery_sample_data.rb`).
- Listing attrs are validated against the category's JSON Schema (`Listing#attrs_match_category_schema`).
- `GET /api/v1/partner/listing_options` returns the bookable categories with their schema.
- Web flow: `/partner/listings/new` (`ListingCategoryPicker`: category + subcategory
  selects) → `/partner/listings/new/details?category=` (`ListingWizard`).
- **No photo storage and no pricing in the API yet.** The current Rate step is UI-only
  ("Rates aren't saved yet").
- Four sample `hotel` listings exist (seed migrations) with attrs like
  `{ guests: 2, amenities: ["fan", "wifi", "breakfast"] }`.

## Design

### Property types — category leaves under Accommodation

The type is what the listing *is*, so it is a category leaf (booking type `stay`), not an
attr. This keeps browse pages (`/[area]/[category]`) and search working per type.

| Slug | Name | Description shown to the partner |
|---|---|---|
| `apartment` | Apartment | A unit in a building or condo, with its own entrance from a shared hallway or lobby. |
| `house` | House | A standalone home. Guests may book the whole house or a room in it. |
| `guest-house` | Guest house | A small, often family-run place with a few rooms — a pension house or homestay. |
| `hotel` | Hotel | A business with many rooms, a front desk and daily housekeeping. |
| `resort` | Resort | A property with leisure on site — a pool, beach access, a restaurant. |
| `villa` | Villa | A private, usually upscale house, often with a garden or pool. |
| `hostel` | Hostel | A budget stay with dorm beds and shared spaces. |
| `cottage` | Cottage or bungalow | A small standalone hut or nipa cottage, often near the beach. |

- New `categories.description` column (text, default `""`, `null: false`), returned by
  `listing_options`. Descriptions live with the category, not hard-coded in the web app.
- The existing `hotel` leaf is renamed to "Hotel" (same id, so existing listings keep it);
  the sample nipa/bamboo cottage listings move to `cottage`.

### Stay attrs — one shared `attribute_schema` for every accommodation leaf

```
place_type   string, enum: entire_place | private_room | shared_room   (required)
beds         array of { type: enum, count: integer 1–20 }, 1+ items     (required)
             type: single | double | queen | king | bunk | sofa_bed | floor_mattress
guests       integer 1–50                                              (required)
bathrooms    number 0–20, multiple of 0.5                              (required)
amenities    array of enum (list below), unique items                  (optional)
```

What each "what guests book" option says:

- **Entire place** — Guests have the whole place to themselves.
- **Private room** — Guests have their own room and share some spaces with others.
- **Shared room** — Guests sleep in a room or dorm shared with others.

### Amenities (grouped in the UI)

- **Essentials**: `wifi`, `aircon`, `fan`, `hot_shower`, `towels_linens`, `toiletries`, `drinking_water`
- **Kitchen and living**: `kitchen`, `refrigerator`, `tv`, `workspace`, `washing_machine`
- **Outside**: `free_parking`, `pool`, `beachfront`, `balcony`, `garden`
- **Services**: `breakfast_included`, `airport_pickup`, `backup_power`
- **Safety**: `smoke_alarm`, `fire_extinguisher`, `first_aid_kit`, `cctv`

The allowed values live in the schema (enum); the web app holds only their labels and grouping.

### Migration (data)

One migration, safe on existing rows:

1. Add `categories.description`.
2. Rename `hotel` → "Hotel", add the other leaves with descriptions, set the shared stay
   schema on all of them.
3. Rewrite existing `stay` listings' attrs to the new shape: keep `guests`; set
   `place_type: private_room`, `beds: [{ type: double, count: 1 }]`, `bathrooms: 1`; map old
   amenities (`hot-shower` → `hot_shower`, `breakfast` → `breakfast_included`, drop unknowns).
4. Move cottage sample listings to `cottage`.

Runs in a worktree (`/raa-task` step 3). It is a deploy change — say so in the PR.

### Web

- `ListingCategoryPicker`: when the group is Accommodation, the subcategory select becomes
  radio cards showing each type's description.
- New `StayWizard` (used when `category.booking_type === "stay"`), steps:
  What guests book → Address → Property info → Amenities → Photos → Title & description → Rate.
  - Property info: a stepper per bed type, plus guests and bathrooms (0.5 steps).
  - Amenities: grouped checkboxes.
  - Photos: a skeleton container only, with **Skip for now**; not wired to anything.
  - Rate: nightly rate (₱), not saved yet — same as today.
- Built from `src/components/ui/` primitives; any new primitive (radio card, number
  stepper) also goes on `/admin/ui-kit`. Mobile-first.
- Edit page (`/partner/listings/[id]/edit`) must render the new attrs for stays.

## Decisions

1. **Photos**: a skeleton upload container only (drop zone and empty tiles), not wired to
   anything and not sent to the API. Real upload is a later ticket.
2. **Title & description**: a step after Photos.
3. **Property types**: the list above, for now.
4. **Tickets**: one `backend` ticket (categories, descriptions, stay schema, data migration,
   API contract) and one `frontend` ticket (picker cards and `StayWizard`), which builds on
   the backend PR.

## Checks

- Backend: `script/test spec/models/listing_spec.rb spec/requests/api/v1/partner/...`,
  then `script/check backend`, `script/check-api --write`.
- Frontend: `script/check frontend`, `script/smoke`, and `/verify-app` for the new flow
  (smoke only reaches the listing gate, not the wizard).
