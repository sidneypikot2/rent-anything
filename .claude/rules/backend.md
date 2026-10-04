---
paths:
  - "backend/**"
---

# Backend conventions

Topic rules load on top of this one when their files are read: `backend-migrations.md` (anything under `db/`). Add a topic rule (auth, payments, bookings) when that area is built — `SPEC.md` holds the design until then.

**API-only** (`ActionController::API`), versioned under `/api/v1` (`app/controllers/api/v1/`) — no views, no cookie sessions. The web app and the future mobile app are both clients of the same API. Access tokens are short-lived JWTs (`app/lib/json_web_token.rb`) sent as `Authorization: Bearer <token>`; refresh tokens arrive with sign-up (M1). CORS allows `ENV["FRONTEND_ORIGIN"]` (default `http://localhost:8100`).

**API contract**: every endpoint has an rswag request spec (`spec/requests/api/v1/`, `require "swagger_helper"`) that both tests it and describes it, with a response `schema` — strict validation is on, so a response key the schema doesn't declare fails the spec. `swagger/v1/openapi.yaml` and `web/src/api/schema.d.ts` are generated from those specs: after changing an endpoint run `script/check-api --write` and commit both. Never edit either by hand (a hook blocks it).

**Service objects** (`app/services/`): controllers only translate a service's return value into an HTTP response — no validation or business logic in controllers. Subclass `ApplicationService`, implement `#initialize`/`#call`, call via the class method (`Listings::Create.call(partner, params)`). Namespace by domain (`Auth::`, `Listings::`, `Bookings::`, `Carts::`, `Payments::`). Don't extract a service for a trivial one-liner action.

**Authorization** is plain Ruby, no gem: scope lookups through the user (`current_user.listings.find(...)`) where possible; otherwise the service raises `NotAuthorizedError`, which `ApplicationController` renders as 403. `RecordNotFound` → 404, `RecordInvalid` → 422 with `errors`. Every new write action needs a spec for the wrong-user case.

**Request values**: don't coerce a value from the request with `.to_s`, `.to_i` or the like in a service — `nil.to_s` turns a missing key into a deliberate empty value, and a hash or array gets stringified and saved. A missing or wrong-typed value is a 422 (add an error and raise `ActiveRecord::RecordInvalid`), with a spec for it.

**Money** is integer centavos in `*_cents` columns, PHP only. Never floats. A booking snapshots its price breakdown and commission rate when it is created.

**Geo**: locations are PostGIS `geography(Point, 4326)` columns (`activerecord-postgis-adapter`); search with `ST_DWithin` / bounding boxes against a GiST index, not by loading rows into Ruby. A listing's exact point is only returned to a guest with a paid booking; everyone else gets the rounded one.

**Jobs and cache** use `solid_queue` / `solid_cache` (own schema files in `backend/db/`). There is no Sidekiq. Redis is only the Action Cable adapter (chat, M6).

**Specs**: for a behaviour change write the spec first — one failing request or service spec, watch it fail for the right reason, then implement. Test through the public interface (the endpoint, `Service.call`), not private methods. Skip test-first for migrations, config and pure refactors already covered. While iterating run only the affected spec files (`script/test spec/...`); run the full suite once before the PR (`script/check backend`).

**Docker**: run every Rails command through `docker compose run --rm backend ...`, never on the host (its Ruby is the wrong version). Specs and rubocop go through `script/test` and `script/lint backend`; rubocop also runs on each Ruby file you edit while the stack is up, fixing what it safely can — when it says it corrected a file, read the file again before editing it. Never edit `db/schema.rb` or `Gemfile.lock` by hand (a hook blocks it) — write a migration / edit the `Gemfile` and run the command.

**Style**: Rubocop uses the `rubocop-rails-omakase` house style; don't fight it with custom rules.

**Gotcha**: the `json` gem is pinned `< 3` and `redis` `< 6` — see the comments in the `Gemfile` before touching either.
