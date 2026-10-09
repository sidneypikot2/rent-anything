# Search index (RAA-60): every name and alias of published areas, published landmarks and
# tags in one materialized view (db/views/search_terms_v01.sql), which Discovery::Search
# reads instead of three tables. Refreshed concurrently by SearchTerms::RefreshJob after a
# change and nightly; a concurrent refresh needs the unique index.
class CreateSearchTerms < ActiveRecord::Migration[8.1]
  def change
    create_view :search_terms, version: 1, materialized: true
    add_index :search_terms, %i[target_type target_id kind term_normalized], unique: true,
      name: "index_search_terms_on_target_and_term"
    add_index :search_terms, :term_normalized, using: :gin, opclass: :gin_trgm_ops
  end
end
