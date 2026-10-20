---
paths:
  - "backend/db/**"
---

# Migrations and schema

**Never change a migration that is on `staging` or `main`** — it has already run in other databases (on `main`, in production), so editing it changes nothing there (a hook blocks the edit). Fix forward with a new migration. A migration that exists only on your branch can still be edited: roll it back first (`db:rollback`), edit, migrate again.

**`schema.rb` is generated.** Run `docker compose run --rm backend bin/rails db:migrate` and commit the result; never edit it (a hook blocks that too). Its diff should contain only what your migration did — if unrelated tables or columns move, the database had drifted: say so instead of committing the noise. One drift is known: a database built by running the migrations (a fresh worktree stack) prints some CHECK constraints differently from one loaded from `schema.rb` (`'guest'::character varying::text, …]` against `'guest'::character varying, …]::text[]`). The same constraint, so keep only your migration's own hunks — for a data migration, just the version line (`git diff -U0`, keep those hunks, `git checkout` the file and `git apply --unidiff-zero` them) — and say so in the PR (RAA-134).

**Production will run these.** There is no production database yet, but once there is (M8) every migration on `main` runs there, so write them as if it existed: mention a migration in the PR, and keep it safe to run against existing rows — a new `null: false` column needs a default, and removing or renaming a column the running code still reads breaks requests during the deploy; split that across two PRs.

**Style**, as in the existing files: one `change` method that Rails can reverse (use `up`/`down` only when it can't), a comment on top saying what the feature is and its ticket (`# Trips (RAA-64): ...`), an index on every foreign key and on anything looked up by, and a unique index — not just a model validation — wherever uniqueness matters.

**Constraints in the database**: rules that must hold under concurrency live in the schema, not only in Ruby — the bookings no-overlap rule is an `EXCLUDE USING gist` constraint (`btree_gist` is enabled), money columns are `bigint ... null: false` with a `CHECK (... >= 0)`, and enums are backed by a `CHECK` on the allowed values — or, for a new one, a Postgres enum type (`create_enum`, as `listings.status` is since RAA-115). A Postgres enum column can't change type while a view reads it: drop and recreate the view around the change (`search_terms`). Geography columns get a GiST index.

**Timestamps**: a new migration's timestamp must be later than the newest one in `db/migrate` and no more than a day ahead of the clock — Rails raises `InvalidMigrationTimestampError` beyond that. If the newest is already in the future, step just past it (+1 hour), not to the next day (RAA-119).

**`cache_schema.rb` and `queue_schema.rb`** belong to Solid Cache and Solid Queue. They change only when those gems are upgraded; don't write migrations against them.

**After a migration**: a running stack applies it on restart (`docker compose restart backend` re-runs `db:prepare`). The test database follows `schema.rb` on the next `rspec` run. Each worktree stack has its own database, so a migration applied in one is not applied in another. A new migration is written in a worktree (`/raa-task` step 3; `guard-edit.sh` blocks one written with Edit/Write in the main checkout, not one from `rails g`), so the main development database only gets it once it merges.
