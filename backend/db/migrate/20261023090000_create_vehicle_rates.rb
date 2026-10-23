# Vehicle pricing (RAA-149): how a motorcycle, car, van, tricycle or multicab rental is
# priced, as PH rental shops price them. A daily rate, and optionally a half-day rate (for
# half_day_hours), an hourly one, and a weekly and monthly total that come out cheaper per
# day. A refundable security deposit, which is never part of the price. Delivery to the
# guest and picking the vehicle up from them at the end, each not offered (null), free (0)
# or a fee. A minimum number of days, and a daily km limit with a fee per km above it. Every
# vehicle listing has one: the existing ones get a zero rate, which means "no price yet"
# until the partner sets one. db/seeds.rb does the same for a database loaded from schema.rb.
#
# Fees may now also be charged per day or per hour of a rental (a passenger helmet, a late
# return).
class CreateVehicleRates < ActiveRecord::Migration[8.1]
  # A vehicle category is one whose attribute_schema asks for make, model and engine_cc
  # (Category#vehicle?).
  def self.backfill(connection)
    connection.execute <<~SQL
      INSERT INTO vehicle_rates (listing_id, created_at, updated_at)
      SELECT listings.id, now(), now() FROM listings
      JOIN categories ON categories.id = listings.category_id
      WHERE categories.attribute_schema->'properties' ?& array['make', 'model', 'engine_cc']
      ON CONFLICT (listing_id) DO NOTHING
    SQL
  end

  OLD_CHARGED_PER = "charged_per IN ('booking', 'night', 'guest', 'guest_night', 'unit')"
  NEW_CHARGED_PER = "charged_per IN ('booking', 'night', 'guest', 'guest_night', 'unit', 'day', 'hour')"

  def change
    create_table :vehicle_rates do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.bigint :daily_price_cents, null: false, default: 0
      t.bigint :half_day_price_cents
      t.integer :half_day_hours, null: false, default: 4
      t.bigint :hourly_price_cents
      t.bigint :weekly_price_cents
      t.bigint :monthly_price_cents
      t.bigint :security_deposit_cents, null: false, default: 0
      t.bigint :delivery_fee_cents
      t.bigint :return_pickup_fee_cents
      t.integer :min_rental_days, null: false, default: 1
      t.integer :km_limit_per_day
      t.bigint :excess_km_fee_cents
      t.timestamps
    end
    add_check_constraint :vehicle_rates, "daily_price_cents >= 0", name: "vehicle_rates_daily_price_check"
    add_check_constraint :vehicle_rates, "half_day_price_cents > 0", name: "vehicle_rates_half_day_price_check"
    add_check_constraint :vehicle_rates, "half_day_hours BETWEEN 2 AND 12", name: "vehicle_rates_half_day_hours_check"
    add_check_constraint :vehicle_rates, "hourly_price_cents > 0", name: "vehicle_rates_hourly_price_check"
    add_check_constraint :vehicle_rates, "weekly_price_cents > 0", name: "vehicle_rates_weekly_price_check"
    add_check_constraint :vehicle_rates, "monthly_price_cents > 0", name: "vehicle_rates_monthly_price_check"
    add_check_constraint :vehicle_rates, "security_deposit_cents >= 0", name: "vehicle_rates_security_deposit_check"
    add_check_constraint :vehicle_rates, "delivery_fee_cents >= 0", name: "vehicle_rates_delivery_fee_check"
    add_check_constraint :vehicle_rates, "return_pickup_fee_cents >= 0", name: "vehicle_rates_return_pickup_fee_check"
    add_check_constraint :vehicle_rates, "min_rental_days BETWEEN 1 AND 365", name: "vehicle_rates_min_rental_days_check"
    add_check_constraint :vehicle_rates, "km_limit_per_day BETWEEN 1 AND 2000", name: "vehicle_rates_km_limit_check"
    add_check_constraint :vehicle_rates, "excess_km_fee_cents >= 0", name: "vehicle_rates_excess_km_fee_check"

    reversible do |dir|
      dir.up do
        self.class.backfill(connection)
        replace_charged_per_check(NEW_CHARGED_PER)
      end
      dir.down do
        execute "DELETE FROM listing_fees WHERE charged_per IN ('day', 'hour')"
        replace_charged_per_check(OLD_CHARGED_PER)
      end
    end
  end

  private

  def replace_charged_per_check(expression)
    remove_check_constraint :listing_fees, name: "listing_fees_charged_per_check"
    add_check_constraint :listing_fees, expression, name: "listing_fees_charged_per_check"
  end
end
