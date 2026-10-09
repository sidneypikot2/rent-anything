-- The search pool (RAA-60): one row per name and per alias of every published area,
-- published landmark and tag, normalized the way Discovery::Search normalizes the query.
-- Whether a place has anything to book is checked when searching, not here, so a new
-- listing needs no refresh; a renamed, re-aliased or (un)published place does.
--
-- v2 (RAA-62): an area's or landmark's Wikidata terms count as aliases, and its Wikidata
-- starting popularity adds to its score.
--
-- popularity: active listings in the place (an area's own and those in published areas under it, a landmark's
-- linked listings), published landmarks in it (for a tag, tagged with it), and how often
-- guests picked it in the last 90 days of search events.
WITH RECURSIVE area_tree(ancestor_id, area_id) AS (
  SELECT id, id FROM areas WHERE status = 'published'
  UNION
  SELECT area_tree.ancestor_id, children.id
  FROM areas children JOIN area_tree ON children.parent_id = area_tree.area_id
  WHERE children.status = 'published'
),
picks AS (
  SELECT target_type, target_id, COUNT(*) AS picks
  FROM search_events
  WHERE target_id IS NOT NULL AND created_at > now() - interval '90 days'
  GROUP BY target_type, target_id
),
area_popularity AS (
  SELECT area_tree.ancestor_id AS id, COUNT(DISTINCT listings.id) + COUNT(DISTINCT landmarks.id) AS score
  FROM area_tree
  LEFT JOIN listings ON listings.area_id = area_tree.area_id AND listings.status = 'active'
  LEFT JOIN landmarks ON landmarks.area_id = area_tree.area_id AND landmarks.status = 'published'
  GROUP BY area_tree.ancestor_id
),
targets AS (
  SELECT 'Area' AS target_type, areas.id AS target_id, areas.name, areas.aliases || areas.wikidata_aliases AS aliases,
    area_popularity.score + areas.wikidata_popularity AS score
  FROM areas JOIN area_popularity ON area_popularity.id = areas.id
  WHERE areas.status = 'published'
  UNION ALL
  SELECT 'Landmark', landmarks.id, landmarks.name, landmarks.aliases || landmarks.wikidata_aliases,
    (SELECT COUNT(*) FROM listing_landmarks JOIN listings ON listings.id = listing_landmarks.listing_id
     WHERE listing_landmarks.landmark_id = landmarks.id AND listings.status = 'active') + landmarks.wikidata_popularity
  FROM landmarks
  WHERE landmarks.status = 'published'
  UNION ALL
  SELECT 'Tag', tags.id, tags.name, tags.aliases,
    (SELECT COUNT(*) FROM landmark_tags JOIN landmarks ON landmarks.id = landmark_tags.landmark_id
     WHERE landmark_tags.tag_id = tags.id AND landmarks.status = 'published')
  FROM tags
),
terms AS (
  SELECT target_type, target_id, name AS term, 'name' AS kind, 2 AS weight, score FROM targets
  UNION ALL
  SELECT target_type, target_id, alias_name, 'alias', 1, score FROM targets, unnest(targets.aliases) AS alias_name
)
SELECT
  unaccent(lower(terms.term)) AS term_normalized,
  MIN(terms.term) AS term,
  terms.target_type,
  terms.target_id,
  terms.kind,
  MAX(terms.weight) AS weight,
  (MAX(terms.score) + COALESCE(MAX(picks.picks), 0))::integer AS popularity
FROM terms
LEFT JOIN picks ON picks.target_type = terms.target_type AND picks.target_id = terms.target_id
WHERE btrim(terms.term) <> ''
GROUP BY unaccent(lower(terms.term)), terms.target_type, terms.target_id, terms.kind
