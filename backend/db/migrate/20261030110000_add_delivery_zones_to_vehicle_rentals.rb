# Delivery zones for vehicle rentals (RAA-205): a shop delivers and collects by distance, a fee
# for each zone out to its farthest (free within 1 km, ₱150 up to 3 km, none beyond), measured
# in a straight line from the listing's pin to the pin the guest drops. vehicle_rates'
# delivery_fee_cents and return_pickup_fee_cents stay whether it delivers or collects, holding
# its nearest zone's fee. A trip item keeps the guest's pin, its distance and notes for the
# rider, and a booking copies them at checkout. A rate that already had a fee gets one zone of
# 5 km at it, and collects at that same fee.
class AddDeliveryZonesToVehicleRentals < ActiveRecord::Migration[8.1]
  def change
    create_table :vehicle_delivery_zones do |t|
      t.references :vehicle_rate, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.integer :max_distance_m, null: false
      t.bigint :fee_cents, null: false
      t.timestamps
      t.index %i[vehicle_rate_id max_distance_m], unique: true, name: "index_vehicle_delivery_zones_on_rate_and_distance"
      t.check_constraint "max_distance_m >= 100 AND max_distance_m <= 50000", name: "vehicle_delivery_zones_distance_check"
      t.check_constraint "fee_cents >= 0", name: "vehicle_delivery_zones_fee_check"
    end

    %i[trip_items bookings].each do |table|
      change_table table, bulk: true do |t|
        t.st_point :delivery_location, geographic: true
        t.integer :delivery_distance_m
        t.string :delivery_notes
        t.check_constraint "delivery_distance_m >= 0", name: "#{table}_delivery_distance_check"
        t.check_constraint "char_length(delivery_notes) <= 200", name: "#{table}_delivery_notes_length_check"
        t.check_constraint "(delivery_location IS NULL) = (delivery_distance_m IS NULL)", name: "#{table}_delivery_location_check"
      end
    end

    reversible do |direction|
      direction.up do
        execute <<~SQL.squish
          INSERT INTO vehicle_delivery_zones (vehicle_rate_id, max_distance_m, fee_cents, created_at, updated_at)
          SELECT id, 5000, COALESCE(delivery_fee_cents, return_pickup_fee_cents), now(), now()
          FROM vehicle_rates WHERE delivery_fee_cents IS NOT NULL OR return_pickup_fee_cents IS NOT NULL
        SQL
        execute <<~SQL.squish
          UPDATE vehicle_rates SET return_pickup_fee_cents = delivery_fee_cents
          WHERE delivery_fee_cents IS NOT NULL AND return_pickup_fee_cents IS NOT NULL
        SQL
      end
    end
  end
end
