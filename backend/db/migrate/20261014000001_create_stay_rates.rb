# Stay pricing (RAA-104): how an accommodation listing is priced, as on Airbnb and
# Booking.com. A nightly price (a weekend one for Friday and Saturday nights if set) covers
# up to base_guests; each guest above that pays the extra-guest fee per night, up to the
# listing's attrs.guests. Stays of 7+ / 28+ nights get the weekly / monthly discount, and
# min_nights / max_nights bound the stay. Only listings under the accommodation category
# have one, and every one does: the existing ones get a zero rate, which means "no price
# yet" until the partner sets one. db/seeds.rb does the same for a database loaded from
# schema.rb.
class CreateStayRates < ActiveRecord::Migration[8.1]
  def self.backfill(connection)
    connection.execute <<~SQL
      INSERT INTO stay_rates (listing_id, created_at, updated_at)
      SELECT listings.id, now(), now() FROM listings
      JOIN categories ON categories.id = listings.category_id
      JOIN categories parents ON parents.id = categories.parent_id
      WHERE parents.slug = 'accommodation'
      ON CONFLICT (listing_id) DO NOTHING
    SQL
  end

  def change
    create_table :stay_rates do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.bigint :nightly_price_cents, null: false, default: 0
      t.bigint :weekend_price_cents
      t.integer :base_guests, null: false, default: 1
      t.bigint :extra_guest_fee_cents, null: false, default: 0
      t.integer :weekly_discount_percent, null: false, default: 0
      t.integer :monthly_discount_percent, null: false, default: 0
      t.integer :min_nights, null: false, default: 1
      t.integer :max_nights
      t.timestamps
    end
    add_check_constraint :stay_rates, "nightly_price_cents >= 0", name: "stay_rates_nightly_price_check"
    add_check_constraint :stay_rates, "weekend_price_cents >= 0", name: "stay_rates_weekend_price_check"
    add_check_constraint :stay_rates, "base_guests BETWEEN 1 AND 50", name: "stay_rates_base_guests_check"
    add_check_constraint :stay_rates, "extra_guest_fee_cents >= 0", name: "stay_rates_extra_guest_fee_check"
    add_check_constraint :stay_rates, "weekly_discount_percent BETWEEN 0 AND 90", name: "stay_rates_weekly_discount_check"
    add_check_constraint :stay_rates, "monthly_discount_percent BETWEEN 0 AND 90", name: "stay_rates_monthly_discount_check"
    add_check_constraint :stay_rates, "min_nights BETWEEN 1 AND 365", name: "stay_rates_min_nights_check"
    add_check_constraint :stay_rates, "max_nights BETWEEN min_nights AND 365", name: "stay_rates_max_nights_check"

    reversible { |dir| dir.up { self.class.backfill(connection) } }
  end
end
