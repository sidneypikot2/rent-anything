module DestinationLinks
  # Links suggested by search events (RAA-60): two published areas or landmarks that guests
  # picked in the same visit, in at least MIN_SESSIONS visits over the retention window, and
  # not linked yet. An admin approves one with DestinationLinks::Approve. Pairs are read in
  # DestinationLink's stored order (lower type and id first), so each shows once.
  class Suggestions < ApplicationService
    include RequestPlaces

    MIN_SESSIONS = 3
    LIMIT = 50

    def call
      rows = SearchEvent.connection.select_rows(SearchEvent.sanitize_sql_array([ <<~SQL.squish, since: SearchEvent::RETENTION.ago, min: MIN_SESSIONS, limit: LIMIT ]))
        WITH picks AS (
          SELECT DISTINCT session_hash, target_type, target_id FROM search_events
          WHERE created_at >= :since AND target_type IN ('Area', 'Landmark')
        )
        SELECT a.target_type, a.target_id, b.target_type, b.target_id, COUNT(*) AS sessions
        FROM picks a
        JOIN picks b ON b.session_hash = a.session_hash
          AND (a.target_type, a.target_id) < (b.target_type, b.target_id)
        WHERE NOT EXISTS (
          SELECT 1 FROM destination_links links
          WHERE links.source_type = a.target_type AND links.source_id = a.target_id
            AND links.target_type = b.target_type AND links.target_id = b.target_id
        )
        GROUP BY a.target_type, a.target_id, b.target_type, b.target_id
        HAVING COUNT(*) >= :min
        ORDER BY sessions DESC, a.target_type, a.target_id, b.target_type, b.target_id
        LIMIT :limit
      SQL

      places = load_places(rows)
      rows.filter_map do |source_type, source_id, target_type, target_id, sessions|
        source = places[[ source_type, source_id ]]
        target = places[[ target_type, target_id ]]
        { source: place_json(source), target: place_json(target), sessions: } if source && target
      end
    end

    private

    # The published areas and landmarks in the rows, by [type, id]; one that has since been
    # unpublished drops its pairs.
    def load_places(rows)
      ids = rows.flat_map { |row| [ row[0..1], row[2..3] ] }.group_by(&:first).transform_values { |pairs| pairs.map(&:last) }
      { "Area" => Area.published, "Landmark" => Landmark.published }.flat_map do |type, scope|
        scope.where(id: ids.fetch(type, [])).map { |record| [ [ type, record.id ], record ] }
      end.to_h
    end
  end
end
