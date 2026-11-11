---
paths:
  - "backend/**"
---

# Backend conventions

Topic rules load on top of this one when their files are read: `backend-migrations.md` (anything under `db/`), `auth.md` (auth services, controllers, the web session), `bookings.md` (bookings and the partner calendar). `payouts.md` covers payout accounts, `payments.md` guest payments on PayMongo.

**API-only** (`ActionController::API`), versioned under `/api/v1` (`app/controllers/api/v1/`) — no views, no cookie sessions. The web app and the future mobile app are both clients of the same API. Access tokens are short-lived JWTs (`app/lib/json_web_token.rb`) sent as `Authorization: Bearer <token>`, with a refresh token from every sign-in (`auth.md`). CORS allows `ENV["FRONTEND_ORIGIN"]` (default `http://localhost:8100`).

**API contract**: every endpoint has an rswag request spec (`spec/requests/api/v1/`, `require "swagger_helper"`) that both tests it and describes it, with a response `schema` — strict validation is on, so a response key the schema doesn't declare fails the spec. `swagger/v1/openapi.yaml` and `web/src/api/schema.d.ts` are generated from those specs: after changing an endpoint run `script/check-api --write` and commit both. Never edit either by hand (a hook blocks it).

**Service objects** (`app/services/`): controllers only translate a service's return value into an HTTP response — no validation or business logic in controllers. Subclass `ApplicationService`, implement `#initialize`/`#call`, call via the class method (`Listings::Create.call(partner, params)`). Namespace by domain (`Auth::`, `Listings::`, `Bookings::`, `Trips::`, `Payments::`). Don't extract a service for a trivial one-liner action.

**Authorization** is plain Ruby, no gem: scope lookups through the user (`current_user.listings.find(...)`) where possible; otherwise the service raises `NotAuthorizedError`, which `ApplicationController` renders as 403. `RecordNotFound` → 404, `RecordInvalid` → 422 with `errors`. Every new write action needs a spec for the wrong-user case.

**Request values**: don't coerce a value from the request with `.to_s`, `.to_i` or the like in a service — `nil.to_s` turns a missing key into a deliberate empty value, and a hash or array gets stringified and saved. A missing or wrong-typed value is a 422 (add an error and raise `ActiveRecord::RecordInvalid`), with a spec for it. A write that only accepts published (or otherwise live) references must still accept the ones the record already has, so unpublishing something later doesn't block every edit of it (RAA-70).

**Secrets in requests**: a new request parameter that carries a secret (a PIN, a code, a token, an account number) goes in `config/initializers/filter_parameter_logging.rb` in the same PR. Match a short name whole (`/\Apin\z/`), so fields like `postal_code` stay readable in the logs.

**Money** is integer centavos in `*_cents` columns, PHP only. Never floats. A booking snapshots its price breakdown and commission rate when it is created.

**Geo**: locations are PostGIS `geography(Point, 4326)` columns (`activerecord-postgis-adapter`); search with `ST_DWithin` / bounding boxes against a GiST index, not by loading rows into Ruby. A listing's exact point is only returned to a guest with a paid booking; everyone else gets the rounded one.

**Visits and the admin overview** (RAA-290): `POST /visits` (public, `rate_limit` per IP) counts a browser once per Manila day (`Visits::Record`, table `site_visits`): only SHA-256 of the browser's random UUID with the day is kept, never an IP, user agent or user id, so keep it that way. `GET /admin/overview` (`Admin::Overview`) sums per Manila day in SQL, online bookings only (`source: checkout`): bookings by `created_at`, booking amount and revenue (`total_cents`, `commission_cents`) by `confirmed_at` for those still `confirmed`, `in_progress` or `completed`. A new figure goes there, grouped the same way, never summed booking by booking in Ruby.

**Lists are always paged** (2026-11-12): every list endpoint answers a page at a time whether or not it is asked to, so no request (a bot's included) reads a whole table: `paginate(relation)` (`Paginated`, `app/controllers/concerns/paginated.rb`, in `ApplicationController`) reads `page` and `per_page` (50 unless asked, at most 200; anything else a 422), cuts the page in SQL, and describes it in headers — `X-Total-Count`, `X-Page`, `X-Per-Page`, `Link` (rel next / prev) — so the body keeps its shape. A list service takes the page as a block (`Discovery::ListingPins.call { paginate(_1) }`: it yields its ordered relation and serializes only what comes back), and a list sorted in Ruby moves its order into SQL first (`Booking.upcoming_first`). Its rswag spec uses `paginated_list`, `page_headers` and `it_behaves_like "a paginated list"` (`spec/support/paginated_list.rb`). A new list endpoint pages too, unless its own rule already bounds it — `search`, `explore`, `stay_mixes`, `partner/landmarks`, `admin/link_suggestions`, `notifications` (a cursor), `admin/areas`, `admin/landmarks`, `admin/bookings`, `partner/bookings`, `book_cards`, `plan_businesses`, `map_pins`, `book_counts`, `partner/calendar` (92 days) — and then it says that bound in its spec's description. CORS exposes the four headers.

**Jobs and cache** use `solid_queue` / `solid_cache` (own schema files in `backend/db/`). There is no Sidekiq.

**Real-time** (RAA-201): AnyCable. `anycable-go` (the `anycable` Compose service) holds the WebSockets at `/cable` and asks Rails over HTTP (`/_anycable`, `anycable-rails-core`) to approve each connection and subscription; Rails broadcasts to its `/_broadcast`. Both use keys derived from `ANYCABLE_SECRET` (`config/anycable.yml`; staging and production mount `/_anycable` only when it is set). Channels are plain Action Cable: `ApplicationCable::Connection` takes the access token as the `token` query param, and `UserChannel` is each user's stream. A message only says what changed (`booking.updated` with id and status) and the client refetches through the API, so permissions stay in the controllers. Broadcast after commit (`ActiveRecord.after_all_transactions_commit`); `Bookings::Transition` does it for every booking status. Specs use the `test` adapter (`spec/channels/`). Redis isn't used by the app now; Valkey stays for AnyCable's `redisx` broadcasts once there are several `anycable-go` nodes.

**Specs**: for a behaviour change write the spec first — one failing request or service spec, watch it fail for the right reason, then implement. Test through the public interface (the endpoint, `Service.call`), not private methods. Skip test-first for migrations, config and pure refactors already covered. While iterating run only the affected spec files (`script/test spec/...`); run the full suite once before the PR (`script/check backend`). Factory defaults must not contain fixed dates or values the app generates from dates (e.g. an auto-made trip name): specs use relative dates (`20.days.from_now`), so a fixed date matches on one day of the year and the spec fails only then (RAA-152). Give such fields a neutral value, and set it in the spec where the behaviour depends on it.

**Docker**: run every Rails command through `docker compose run --rm backend ...`, never on the host (its Ruby is the wrong version). Specs and rubocop go through `script/test` and `script/lint backend`; rubocop also runs on each Ruby file you edit while the stack is up, fixing what it safely can — when it says it corrected a file, read the file again before editing it. Never edit `db/schema.rb` or `Gemfile.lock` by hand (a hook blocks it) — write a migration / edit the `Gemfile` and run the command.

**Style**: Rubocop uses the `rubocop-rails-omakase` house style; don't fight it with custom rules.

**Gotcha**: the `json` gem is pinned `< 3` and `redis` `< 6` — see the comments in the `Gemfile` before touching either.
