# One name or alias of a published area, published landmark or tag, from the search_terms
# materialized view (RAA-60, db/views/search_terms_v01.sql). Discovery::Search reads these
# instead of the three tables. Read-only: it changes when the view is refreshed, which
# SearchTerms::RefreshJob does after a change to a name, alias or status, and nightly.
class SearchTerm < ApplicationRecord
  belongs_to :target, polymorphic: true

  # Concurrent refresh doesn't block searches while it runs, but needs a populated view;
  # specs refresh inside their transaction, where a plain refresh is enough.
  def self.refresh(concurrently: false)
    Scenic.database.refresh_materialized_view(table_name, concurrently:, cascade: false)
  end

  # Text the way the view stores it: lower case, no accents, trimmed.
  def self.normalize(text)
    connection.select_value(sanitize_sql_array([ "SELECT unaccent(lower(?))", text.strip ]))
  end

  def readonly?
    true
  end
end
