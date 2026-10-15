# Listing statuses (RAA-115): partners go live, pause and delist their own listings, so the
# status becomes a Postgres enum of draft, active, paused and delisted. pending (an admin
# review never built) goes: its rows become drafts. The search_terms materialized view reads
# listings.status, so it is dropped around the type change and made again with its indexes.
class ConvertListingStatusToEnum < ActiveRecord::Migration[8.1]
  STATUSES = %w[draft active paused delisted].freeze
  OLD_STATUSES = %w[draft pending active].freeze

  def up
    execute "UPDATE listings SET status = 'draft' WHERE status = 'pending'"
    remove_check_constraint :listings, name: "listings_status_check"
    drop_view :search_terms, materialized: true
    create_enum :listing_status, STATUSES
    change_column_default :listings, :status, nil
    change_column :listings, :status, :enum, enum_type: :listing_status, null: false,
      using: "status::listing_status"
    change_column_default :listings, :status, "draft"
    create_search_terms
  end

  def down
    execute "UPDATE listings SET status = 'draft' WHERE status IN ('paused', 'delisted')"
    drop_view :search_terms, materialized: true
    change_column_default :listings, :status, nil
    change_column :listings, :status, :string, null: false, using: "status::text"
    change_column_default :listings, :status, "draft"
    drop_enum :listing_status
    add_check_constraint :listings, "status IN (#{OLD_STATUSES.map { "'#{_1}'" }.join(', ')})",
      name: "listings_status_check"
    create_search_terms
  end

  private

  def create_search_terms
    create_view :search_terms, version: 2, materialized: true
    add_index :search_terms, %i[target_type target_id kind term_normalized], unique: true,
      name: "index_search_terms_on_target_and_term"
    add_index :search_terms, :term_normalized, using: :gin, opclass: :gin_trgm_ops
  end
end
