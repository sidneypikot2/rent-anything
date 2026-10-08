---
name: seed-place
description: Make one place a destination (publish its gazetteer area and add its search terms, landmarks and destination links) from free open data, write it as a data migration and load it into the database. Run when the user asks to seed, add or populate a place.
argument-hint: "<place, e.g. \"Moalboal\" or \"Malapascua Island\"> [RAA-<n>] [with sample listings]"
disable-model-invocation: true
---

# Seed a place

This follows the "Building the destination pool" design. The place goes into our own
gazetteer (`areas`, `landmarks`, `tags`, and `destination_links` once that table exists).
Outside data is fetched once, at seeding time, and never at request time. Guests only ever
search what is in Postgres.

Place: $ARGUMENTS

Where things stand right now:

```!
git branch --show-current
git status --short
git worktree list
```

The pattern to copy is `backend/db/migrate/20261006000001_seed_discovery_sample_data.rb`:
constant arrays of rows, raw SQL inserts that look up ids by slug, and a `down` that
removes exactly those rows. `backend/db/migrate/20261008000000_seed_santa_fe_sample_partner.rb`
shows a town added under an existing island, plus a sample partner.

## 1. Ticket, branch and worktree

The result is a migration, so this is a `backend` task in a worktree (`/raa-task` steps 2
and 3). If the arguments include an `RAA-<n>`, use it. If they don't, create the ticket as
`/raa-task` does: "Seed <place> destination data". Then enter the worktree
`raa-<n>-seed-<place-slug>` and run `script/worktree-env`. Never write the migration in the
main checkout, because `guard-edit.sh` blocks it there.

## 2. Find what already exists

Start the worktree's database (`docker compose up -d db`, then
`docker compose run --rm backend bin/rails db:prepare`). List what is already there with
`docker compose run --rm backend bin/rails runner`: areas (slug, kind, parent), the tags
(slug, kind), and the landmarks near the place.

Reuse existing rows, referring to them by slug. Only add what is missing. A town on an
island goes under that island, not under the province (Santa Fe → Bantayan Island → Cebu).

**Areas come from the gazetteer (RAA-59), not from this skill.** Run
`docker compose run --rm backend bin/rails gazetteer:import` in the worktree first: every
region, province, city and town is then there as a draft, with its PSGC code and boundary.
Don't insert areas or fetch boundaries. An island that isn't there yet goes in
`backend/db/gazetteer/curated.yml` (slug, name, a point on it, aliases) and the import
builds it. The migration publishes the place and every area above it
(`UPDATE areas SET status = 'published'` by slug, `down` sets the ones it published back to
draft), and raises if the place is missing, so a database that hasn't been imported fails
loudly; say in the PR that `gazetteer:import` runs before it.

## 3. Gather the data from free open sources

Fetch once, cache the raw responses in the scratchpad, and keep a source note for each value.
Send a `User-Agent: rent-anything-seed/1.0 (<user email>)` header, and stay within each
service's usage policy: a handful of Overpass queries, never bulk downloads.

| Data | Source | How |
|---|---|---|
| Official name, parents, kind, center and boundary | The gazetteer (step 2) | Already imported; only aliases are added here |
| Candidate landmarks | Overpass API | `tourism=attraction|viewpoint|museum`, `natural=waterfall|beach|cave_entrance`, `historic=*`, `leisure=nature_reserve`, all inside the boundary. Keep about the top 5–15 by Wikidata or Wikipedia presence |
| Search terms (aliases) and a popularity hint | Wikidata | The place's and each landmark's labels and aliases in `en`, `tl` and `ceb`, plus the sitelink count |
| Destinations usually visited together | Your knowledge, checked against Wikivoyage's "Go next" section | Propose them; the user confirms |

Generate search terms from the official name:
- drop "City of", "Municipality of" and "Island";
- expand Sto./Sta./Gen.;
- add the local names Wikidata gives.

Lowercase duplicates and terms already used by another place are dropped.

## 4. Review with the user before writing

Show one compact table per kind:
- areas to publish: slug, kind, parent, aliases to add;
- landmarks: slug, name, location, proposed tags, `published` or `draft`;
- new tags, if any;
- destination links: pair, `bundled` or `adjacent`, weight;
- sample partners and listings, only if asked for.

Landmarks default to `draft` unless the user publishes them. Sample partners and listings
are fictional: `@example.com`, no password, a note in the description. Wait for the user's
corrections and approval. They can't be made in the migration after it merges.

## 5. Write the data migration

- Name it `backend/db/migrate/<timestamp>_seed_<place_slug>_destination.rb`. Generate it with
  `docker compose run --rm backend bin/rails g migration Seed<Place>Destination` and replace
  the body.
- The top comment says what the place is, the ticket, the sources and their licenses:
  "Landmarks © OpenStreetMap contributors, ODbL; aliases from Wikidata, CC0".
- Use the same constants and helpers as the discovery seed: `AREAS`, `LANDMARKS`, `TAGS` (new
  only), `LINKS` (only if `destination_links` exists in `backend/db/schema.rb`), and `PARTNERS` /
  `LISTINGS` only when sample listings were asked for.
- A link is stored once, with the lower `(type, id)` end as the source (`Area` before
  `Landmark`, then the lower id; a CHECK enforces it). Insert each pair with a
  `SELECT ... CASE` that swaps the ends when needed, and skip pairs whose other end doesn't
  exist yet: the migration that adds that place adds the link.
- `up` skips rows whose slug already exists (`ON CONFLICT (slug) DO NOTHING`).
- `down` deletes only the slugs this migration owns: children before parents, join rows first.
- Listings must satisfy the listing rules: `area_id` is the area whose boundary covers the
  point, the address fields are filled in, and `attrs` matches the category's
  `attribute_schema`.
- Add a block to `backend/db/seeds.rb` as for the Santa Fe seed, guarded by
  `Area.exists?(slug: "<place-slug>")`, so a fresh database gets the place too.

## 6. Populate the database and check it

In the worktree:
1. `docker compose run --rm backend bin/rails db:migrate`. `schema.rb` should change only its
   version line; anything else means the database had drifted, so say so.
2. Run `docker compose run --rm backend bin/rails db:rollback`, then `db:migrate` again, to
   prove `down` and `up` are clean.
3. Spot-check with `docker compose run --rm backend bin/rails runner`:
   - the row counts per table;
   - every listing and landmark point is covered by its area's (or island's) boundary
     (`ST_Covers`);
   - the place and every area above it are published.
4. Start the stack (`docker compose up -d`) and check the API:
   - `curl` `/api/v1/search?q=<place>` and `/api/v1/search?q=<an alias>`, each on the
     backend port in `.env`;
   - `/api/v1/areas/<slug>`.
   They should find the place, and they will once it has an active listing (areas only show
   when bookable).
5. Run `script/check backend`.

Report what was added (counts per table), which values came from which source, anything
left as `draft`, and that the main development database only gets the place after the PR
merges (`docker compose restart backend` there runs the pending migration). Then carry on
with `/raa-task` from its check step: commit, PR, ticket to In Review. Say in the PR that it
is a data migration and that staging runs it on deploy.
