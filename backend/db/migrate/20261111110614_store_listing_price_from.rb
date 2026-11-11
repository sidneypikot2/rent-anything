# What to book at scale (2026-11-11): a listing's from-price stored on it, so browsing sorts and
# filters by price without working it out per row, kept by the database whenever a rate, a tour, a
# water activity's offers or its details change (whatever writes them: a service, update_all, raw
# SQL). listing_price_from is PricingSerializer.price_from_cents in SQL (keep the two in step); a
# partial index serves the browse pages' active listings of a place by category.
class StoreListingPriceFrom < ActiveRecord::Migration[8.1]
  PRICED_TABLES = %i[stay_rates vehicle_rates flat_rates tour_details activity_offers activity_details].freeze

  def change
    add_column :listings, :price_from_cents, :bigint
    add_check_constraint :listings, "price_from_cents > 0", name: "listings_price_from_check"
    add_index :listings, %i[area_id category_id], where: "status = 'active'", name: "index_listings_active_by_area_and_category"

    create_function :listing_price_from, sql_definition: <<~SQL
      CREATE OR REPLACE FUNCTION listing_price_from(listing bigint) RETURNS bigint
      LANGUAGE sql STABLE AS $$
        SELECT COALESCE(
          (SELECT NULLIF(nightly_price_cents, 0) FROM stay_rates WHERE listing_id = listing),
          (SELECT NULLIF(daily_price_cents, 0) FROM vehicle_rates WHERE listing_id = listing),
          (SELECT NULLIF(price_cents, 0) FROM flat_rates WHERE listing_id = listing),
          (SELECT NULLIF(base_price_cents, 0) FROM tour_details WHERE listing_id = listing),
          (SELECT MIN(price_cents) FROM activity_offers
            WHERE listing_id = listing AND archived_at IS NULL
              AND EXISTS (SELECT 1 FROM activity_details WHERE activity_details.listing_id = listing))
        )
      $$;
    SQL
    create_function :refresh_listing_price_from, sql_definition: <<~SQL
      CREATE OR REPLACE FUNCTION refresh_listing_price_from() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP <> 'INSERT' THEN
          UPDATE listings SET price_from_cents = listing_price_from(OLD.listing_id) WHERE id = OLD.listing_id;
        END IF;
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.listing_id IS DISTINCT FROM OLD.listing_id) THEN
          UPDATE listings SET price_from_cents = listing_price_from(NEW.listing_id) WHERE id = NEW.listing_id;
        END IF;
        RETURN NULL;
      END
      $$;
    SQL
    PRICED_TABLES.each do |table|
      create_trigger :"#{table}_refresh_listing_price_from", on: table, sql_definition: <<~SQL
        CREATE TRIGGER #{table}_refresh_listing_price_from
        AFTER INSERT OR UPDATE OR DELETE ON #{table}
        FOR EACH ROW EXECUTE FUNCTION refresh_listing_price_from();
      SQL
    end

    up_only { execute "UPDATE listings SET price_from_cents = listing_price_from(id)" }
  end
end
