# Gear on the rental rules (RAA-254): cameras and snorkel sets rent as vehicles do, 24 hours a day
# from a pickup, so every gear listing moves from its flat rate to a vehicle rate with the same
# daily price (0, "no price yet", without one). Gear bookings get the period a vehicle booking
# keeps, from the default pickup, or the availability checks by the hour wouldn't see them.
# db/seeds.rb runs the same backfill for a database loaded from schema.rb.
#
# Rolling back keeps only the daily price: deposits and delivery zones set since are lost.
class MoveGearToVehicleRates < ActiveRecord::Migration[8.1]
  # Category#gear?: a rental under Equipment rental.
  GEAR_LISTINGS = <<~SQL.freeze
    SELECT listings.id FROM listings
    JOIN categories ON categories.id = listings.category_id
    JOIN categories parents ON parents.id = categories.parent_id
    WHERE categories.booking_type = 'rental' AND parents.slug = 'equipment-rentals'
  SQL

  def self.backfill(connection)
    connection.execute <<~SQL
      INSERT INTO vehicle_rates (listing_id, daily_price_cents, created_at, updated_at)
      SELECT gear.id, COALESCE(flat_rates.price_cents, 0), now(), now()
      FROM (#{GEAR_LISTINGS}) gear
      LEFT JOIN flat_rates ON flat_rates.listing_id = gear.id
      ON CONFLICT (listing_id) DO NOTHING
    SQL
    connection.execute "DELETE FROM flat_rates WHERE listing_id IN (#{GEAR_LISTINGS})"
    connection.execute <<~SQL
      UPDATE bookings
      SET starts_at = (starts_on + time '09:00') AT TIME ZONE 'Asia/Manila',
          ends_at = ((starts_on + time '09:00') AT TIME ZONE 'Asia/Manila') + GREATEST(ends_on - starts_on, 1) * interval '1 day'
      WHERE starts_at IS NULL AND listing_id IN (#{GEAR_LISTINGS})
    SQL
  end

  def up
    self.class.backfill(connection)
  end

  def down
    connection.execute <<~SQL
      INSERT INTO flat_rates (listing_id, price_cents, created_at, updated_at)
      SELECT listing_id, daily_price_cents, now(), now() FROM vehicle_rates
      WHERE listing_id IN (#{GEAR_LISTINGS})
      ON CONFLICT (listing_id) DO NOTHING
    SQL
    connection.execute "DELETE FROM vehicle_rates WHERE listing_id IN (#{GEAR_LISTINGS})"
    connection.execute "UPDATE bookings SET starts_at = NULL, ends_at = NULL WHERE listing_id IN (#{GEAR_LISTINGS})"
  end
end
