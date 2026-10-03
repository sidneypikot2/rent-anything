# CLAUDE.md

`SPEC.md` holds the product and domain design (booking types, per-area cart, booking lifecycle, integrations, roadmap) and why. It is not loaded automatically — read it when a task touches those. For what actually exists, `backend/config/routes.rb`, `backend/db/schema.rb` and `backend/swagger/v1/openapi.yaml` are authoritative.

Keep replies short: lead with the result, include what the reader needs to act on it, and leave out long code snippets.

When compacting, keep the list of modified files, the current RAA ticket and branch, and the commands that were used to check the work.
A session cannot see its own context size, so judge by what it holds: at a natural break (checks green, PR opened, handover) in a session that has run long, has already been summarised once, or has taken in browser screenshots or large logs, suggest `/compact` — or `/clear` when the ticket is handed over.

When adding a gem or library, or using a third-party API not already used in this repo, look up the official documentation first. Follow existing in-repo usage otherwise.
Use context7 directly for a single lookup; use the DocsExplorer subagent only when several technologies need looking up at once. For Next.js, the docs bundled in `web/node_modules/next/dist/docs/` match the installed version.

A repeated mistake or a recurring review comment is an edit to a `.claude/rules/` file (or a hook, if it must always hold), proposed as a PR — not a correction that stays in chat. `/raa-finish` asks for these at the end of every task.

Claude Code config is checked in under `.claude/`: subagents in `agents/`, skills in `skills/` (`/raa-task`, `/raa-finish`, `/release`, `/verify-app` — user-invoked only), shared settings and hooks in `settings.json` / `hooks/`, MCP servers in `.mcp.json`, and conventions in `rules/`, which load automatically when matching files are read. Put new conventions in a rule file scoped by `paths:` to the files they concern — a new topic gets its own file — not in this file.

## Conventions

These apply to every task, whether or not `/raa-task` was run:

- **Area**: `frontend` (the Next.js app in `web/`), `backend` or `infra` — one per task, used as the Jira label, GitHub label and branch prefix.
- **Two protected branches**: `staging` (the default branch) is where task PRs merge; `main` is what production runs and only ever receives `staging`, as a release (`/release`). Never commit on either, and never open a task PR against `main`.
- **Branch**: `<area>/raa-<n>-<kebab-summary>` from an up-to-date `origin/staging`.
- **Commit subject and PR title**: `RAA-<n> <summary>`, PR base `staging`. CI checks the branch name, PR title and area label, and that a PR into `main` comes from `staging` (`.github/workflows/pr-conventions.yml`).
- **Done** means `script/check <area>` passes — it runs what CI runs. For backend changes run only the affected specs while iterating (`script/test spec/...`) and `script/check backend` once before the PR. A changed endpoint means regenerating the API contract (`script/check-api --write`) and committing both generated files. For frontend changes, and backend changes the web app calls, also run `script/smoke` — it drives the real app in a browser. It covers one path only: beyond it, say plainly that the change was not verified in the running app unless `/verify-app` was run.

## Git safety

Do task work in a git worktree (`.claude/worktrees/<name>`), not by switching the main checkout's branch — the user and other sessions work there. Never stash, reset or discard existing work to make room; if something is in the way, stop and report it. Stage only the files that belong to the task. `.githooks/` refuses commits and pushes on `main` and `staging` (enabled by `core.hooksPath`, set on session start); `.claude/hooks/guard-bash.sh` and `guard-edit.sh` block the destructive commands and edits to generated files. Don't work around either — when one blocks something that should be allowed, fix the guard and add the case to `script/test-hooks`.

## Project overview

Rent-Anything makes a trip to one area easy: a traveller picks an area (Moalboal first) and books tours and activities, airport transfers, motorbikes and trikes, freediving and water gear, cameras and stays from local owners — in one per-area cart and one checkout. The platform takes a commission per booking. Built so far: the foundation (API health, OpenAPI contract, web shell); `SPEC.md` has the design and the roadmap (M1–M8).

- **Backend**: Ruby on Rails 8.1 (API-only, `/api/v1`), Ruby 4.0.6, PostgreSQL 18 + PostGIS 3.6, RSpec + FactoryBot + rswag — `backend/`
- **Web**: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, TanStack Query, openapi-fetch; Node 24 — `web/`
- **Mobile**: later; it will use the same API and OpenAPI contract
- **Infra**: Docker Compose runs four services (db, redis, backend, web); Redis is the Action Cable adapter

Work is tracked in Jira, not in this repo: project `RAA` (Rent-Anything-Anywhere), site `https://sidneypikot2.atlassian.net`, cloudId `ca2c20d7-9b28-45c4-a475-81e449242242`. Statuses: To Do → In Progress → In Review → Done.

**No production yet.** A host is chosen at M8 (launch). Until then a release only moves `main`; still treat migrations, CORS / `FRONTEND_ORIGIN`, `web/src/lib/config.ts` and new environment variables as production changes and say so in the PR.

## Running and checking

Requires Docker Desktop only (and `jq`, `gh`). `docker compose up` — web at http://localhost:8100, backend at http://localhost:3100 (health check `/up`, API health `/api/v1/health`, OpenAPI at `/api-docs/v1/openapi.yaml`). The ports differ from PikotChat's so both stacks can run at once. First run creates the databases via `db:prepare`; the web container installs its dependencies into a volume.

```bash
script/test [spec/path_spec.rb[:LINE]]    # backend specs; no argument: the full suite
script/lint [backend [-a] | frontend]     # rubocop and eslint
script/check [frontend|backend|tooling]   # everything CI runs for that area (no argument: all of it)
script/check-api [--write]    # the API contract: request specs -> openapi.yaml -> web types
script/smoke                  # browser smoke test (Playwright container) against this checkout's stack
script/check-docs             # these instruction files vs the repo: dead paths, rules that never load
script/worktree-env           # in a worktree, once: own ports (8100+N / 3100+N) and project name
script/docker-sweep           # Docker stacks left behind by removed worktrees (--apply deletes them)
docker compose run --rm backend bin/rails db:migrate
docker compose run --rm backend bundle install && docker compose build backend   # after a Gemfile change
docker compose run --rm web npm install <pkg>    # web dependencies, resolved in the container's Node
```

`script/test` and `script/lint` are the only places the rspec, rubocop and eslint commands are written; they use the running containers when the stack is up and one-off containers otherwise. The host's Ruby is the wrong version — never run Rails commands outside Docker.

In a cloud session the VM's own Ruby and PostgreSQL are the wrong versions — use `docker compose` there too (`.claude/hooks/cloud-start.sh` starts db and redis). The conventions above hold there as well: rename the session's branch to `<area>/raa-<n>-<kebab-summary>` before pushing (CI rejects any other name), and ask for the ticket key if the task didn't come with one. There is no worktree, Discord or `/verify-app` in the cloud.

`docker-compose.yml` must NOT set `RAILS_ENV` in the backend's `environment:` block — every one-off `docker compose run backend ...` inherits it, and the specs need Rails' `test` default. It's set inline in `command:` instead, so `docker compose exec` needs `-e RAILS_ENV=development`.

## Architecture

The backend is API-only with short-lived JWT access tokens; the web app reaches it only through `apiClient()` in `web/src/api/client.ts`, typed from the generated `web/src/api/schema.d.ts`. Public browse pages are server-rendered; signed-in pages are client components. Details and gotchas for each side are in `.claude/rules/`.
