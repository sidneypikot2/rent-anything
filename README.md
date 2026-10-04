# Rent-Anything

Plan a trip to one area in one place: tours and activities, airport transfers, motorbikes
and trikes, freediving and water gear, cameras and stays from local partners — in one cart
per area. Launching in Moalboal, Cebu.

- `backend/` — Rails 8.1 API (Ruby 4.0.6, PostgreSQL 18 + PostGIS)
- `web/` — Next.js 16 + TypeScript
- `SPEC.md` — product and domain design, roadmap

## Run it

Needs Docker Desktop.

```bash
docker compose up
```

- Web: http://localhost:8100
- API: http://localhost:3100 (`/up`, `/api/v1/health`, OpenAPI at `/api-docs/v1/openapi.yaml`)

Git hooks that refuse commits on `main`/`staging`: `git config core.hooksPath .githooks`
(Claude Code sessions set it automatically).

## Check it

```bash
script/check     # everything CI runs
script/smoke     # browser smoke test against the running stack
```

Working conventions (branches, tickets, definition of done) are in `CLAUDE.md`.
