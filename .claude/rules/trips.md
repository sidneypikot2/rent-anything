---
paths:
  - "backend/app/models/trip.rb"
  - "backend/app/models/trip_item.rb"
  - "backend/app/models/concerns/date_range.rb"
  - "backend/app/services/trips/**"
  - "backend/app/jobs/trips/**"
  - "backend/app/controllers/api/v1/trips_controller.rb"
  - "backend/app/controllers/api/v1/trip_items_controller.rb"
  - "backend/app/serializers/trip_serializer.rb"
---

# Trips: the cart (RAA-64)

The cart is a list of the guest's **trips**. Each trip has a name, optional dates and a guest count, and its **items** can come from any area. There is no per-area cart. `SPEC.md` ("Area-first browsing, a cart of trips") holds the design and the team's decisions.

**Guest-only.** `/api/v1/trips` and `/api/v1/trip_items` need a signed-in guest (401, then 403 for a partner or admin). Look a trip up through `current_user.trips`, and an item through a join on its trip's `user_id`, so another guest's trip or item is a 404. A trip id taken from the body (`trip_id`, `move_to_trip_id`, `into_trip_id`) goes through the same scope.

**Dates**: `starts_on`/`ends_on` are both set or both null (`DateRange`, plus a CHECK constraint), and a date that is being set can't be in the past. **A trip's dates always cover its dated items.** Adding, moving or re-dating an item calls `Trip#cover` before saving, and `Trip` refuses dates that would leave an item outside. An undated item can sit in any trip, but checkout will refuse it. Every service that changes a trip's dates or items locks the trip rows first (`Trip.lock_all`, or `lock!`) inside its transaction, so concurrent requests can't break the rule.

**Which trips show**: the cart (`GET /trips`, `Trip.in_cart`) keeps a trip until its `deletes_on`, so the deletion notice has somewhere to show. Suggestions use only `Trip.current`, which excludes ended trips and undated ones past their deletion date. Deleting a listing deletes its trip items: the foreign key cascades, and so does `Listing has_many :trip_items`. Revisit both once items can be booked.

**Destination** (`Trips::Destination.for`): the area's published island, otherwise the nearest city or town in its lineage, never a province. It names new trips (`"Bantayan Island · Nov 12–15"`) and matches undated items to trips. A guest's trip name is free text after that: never parse it.

**Suggestion** (`Trips::Suggest`): only trips that haven't ended, or undated ones not past their deletion date, count (`Trip.current`). For a dated item, take the trip with the smallest date gap up to `GAP_DAYS` (3), and break ties by the distance from the listing to the trip's items in SQL. For an undated item, take the most recently edited trip with the same destination. `trips.updated_at` means "last edited" because items `touch` their trip; the cleanup job relies on that too. `trip_items.followed_suggestion` records whether the add went to the suggested trip, so the 3-day gap can be tuned. Keep it set on every add.

**Cleanup** (RAA-65): nothing is stored for the notice; `Trip#deletes_on` derives it. The notice starts the day after a trip ends, or `STALE_DAYS` (60) after an undated trip's last edit, and `deletes_on` is `CLEANUP_DAYS` (7) later; before that it's nil. `Trip.in_cart`, `Trip.current` and `Trip.due_for_cleanup` split trips on that same date through `Trip.ended_cutoff` / `undated_cutoff`; change those and `#deletes_on` together. Dates are UTC (`Date.current`, no `config.time_zone`), so the job runs at 00:30 UTC. `Trips::Cleanup` (`Trips::CleanupJob` in `config/recurring.yml`) locks each due trip, checks again (an edit resets an undated trip's clock) and deletes it with its items. No email in M4.

**Not here yet**: prices and availability (re-quoted at checkout), booking state and trip status (planning → partly booked → booked), checkout itself (to be decided with Xendit), and signed-out trips. Once items can be booked, `Trips::Cleanup` deletes only unbooked items and keeps a trip that still has booked ones. Once items can be booked, a booked item can't be moved, removed or deleted with its trip.
