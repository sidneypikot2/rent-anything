# Gazetteer data (RAA-59)

The areas guests search and browse: every region, province, city and town in the
Philippines with its official code and boundary, plus the islands we curate. `bin/rails
gazetteer:import` loads these files into `areas` (re-runnable; new areas are drafts) and
`bin/rails gazetteer:publish SLUGS=...` puts areas live. Nothing here is fetched while a
guest searches.

| File | What | Made by |
|---|---|---|
| `areas.geojson.gz` | One feature per region, province, city and town: `psgc_code`, `name`, `kind`, `parent_psgc_code` and its boundary (simplified to about 20 m), or no geometry when COD-AB has none | `script/gazetteer-prepare` |
| `landmasses.geojson.gz` | The country's land split into separate polygons, one per island; curated islands take their boundary from here | `script/gazetteer-prepare` |
| `curated.yml` | Hand-made areas mapped to their PSGC code, and the islands we build | by hand |

## Sources and licences

Only free, openly licensed data. Checked 9 Oct 2026.

- **Philippine Standard Geographic Code (PSGC)**, Philippine Statistics Authority:
  names, 10-digit codes and levels. PSA open data, Creative Commons Attribution
  (https://openstat.psa.gov.ph/Terms). Credit: "Source: Philippine Statistics Authority,
  PSGC. Modified." We changed it: names tidied ("City of Talisay" → "Talisay City"),
  barangays and sub-municipalities left out.
- **Philippines subnational administrative boundaries (COD-AB) v03**, OCHA, from PSA and
  NAMRIA data, on HDX (https://data.humdata.org/dataset/cod-ab-phl): boundaries and
  the province each city sits in. CC BY-IGO. Credit: "Boundaries: OCHA, PSA and NAMRIA,
  via HDX. Simplified." The boundaries are not an official endorsement of any border.
- **Wikidata** (CC0) and **Wikimedia pageviews**: extra search terms (labels and aliases
  in en, tl, ceb) and a starting popularity for published areas and landmarks. Read live
  by `bin/rails gazetteer:wikidata`, not stored here. No credit required; credit
  "Wikidata" anyway wherever these terms show.

Not used: OpenStreetMap (ODbL share-alike could reach our own listings if its island
outlines filtered them), GADM (non-commercial only), the psgc.gitlab.io API (no licence,
data stops at 2022).

The credits must show wherever these boundaries or names are shown as data (a credits page
in the web app).

## Refreshing (quarterly, when the PSA publishes a new PSGC)

1. Download the latest PSGC datafile (xlsx) from https://psa.gov.ph/classification/psgc
   (the site refuses scripted downloads) and `phl_admin_boundaries.gdb.zip` from the HDX
   page above. Keep both outside the repo.
2. `script/gazetteer-prepare <psgc.xlsx> <phl_admin_boundaries.gdb.zip>` rewrites the two
   `.geojson.gz` files. It runs GDAL in its official container; nothing to install.
3. Update the versions below, commit, and after the merge run `bin/rails gazetteer:import`
   against each database.

Current: PSGC 2Q 2026 (published 30 June 2026; 18 regions, 82 provinces, 149 cities, 1,493
municipalities); COD-AB v03 (valid on 2025-02-13).

Places without a boundary (they fall back to the area tree): the Negros Island Region,
which is newer than COD-AB, and the 44 Maguindanao towns and Cotabato City, whose codes
changed when the province split in 2022. COD-AB's own cities with no town-level polygon
(the City of Manila) take their district's.

## Publishing

Imported areas are drafts. Publish a destination, with every area above it, once it has
something to offer: `bin/rails gazetteer:publish SLUGS=moalboal,badian`. An island is
added to `curated.yml` (a point anywhere on it) and built by the next import.

## Wikidata enrichment

After publishing, run `bin/rails gazetteer:wikidata`. It matches each published area and
landmark to a Wikidata item once:
- an area by its PSGC code (Wikidata keeps the old 9-digit form), otherwise by name within
  10 km;
- a landmark by name within 2 km.

It then stores the item's terms in `wikidata_aliases` and a starting popularity in
`wikidata_popularity`. The curated `aliases` are never touched. A place it reports as
skipped (no match, several, or an item another place already has) needs its
`wikidata_id` set by hand; a re-run then picks it up.
