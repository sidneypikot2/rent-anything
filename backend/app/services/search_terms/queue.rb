module SearchTerms
  # The admin's search-term queue (RAA-60): recent queries that found nothing or whose
  # results guests rarely picked, most searched first. Each is a candidate alias for some
  # place (SearchTerms::Add). A query that already matches a term exactly is left out.
  class Queue < ApplicationService
    LIMIT = 50
    # Picked in fewer than 1 in this many searches counts as rarely picked.
    PICK_RATE = 5

    def call
      SearchEvent.recent
        .where("NOT EXISTS (SELECT 1 FROM search_terms WHERE search_terms.term_normalized = search_events.query_normalized)")
        .group(:query_normalized)
        .having("COUNT(target_id) * ? < COUNT(*)", PICK_RATE)
        .order(Arel.sql("COUNT(*) DESC, query_normalized"))
        .limit(LIMIT)
        .pluck(:query_normalized, Arel.sql("COUNT(*)"), Arel.sql("COUNT(target_id)"),
          Arel.sql("COUNT(*) FILTER (WHERE result_count = 0)"))
        .map { |query, searches, picks, zero_results| { query:, searches:, picks:, zero_results: } }
    end
  end
end
