# Vehicle rentals by the 24 hours from a pickup time (RAA-195): a vehicle booking keeps its
# period (starts_at, ends_at), a trip item the pickup time the guest picked ("08:30", Manila
# time), and a vehicle rate the shop's pickup hours and the time a returned vehicle needs before
# the next rental. Existing vehicle bookings are given a 9:00 pickup.
class AddRentalPeriods < ActiveRecord::Migration[8.1]
  def change
    change_table :bookings, bulk: true do |t|
      t.datetime :starts_at
      t.datetime :ends_at
      t.check_constraint "(starts_at IS NULL) = (ends_at IS NULL)", name: "bookings_period_both_or_neither_check"
      t.check_constraint "ends_at > starts_at", name: "bookings_period_order_check"
      t.index %i[listing_id starts_at ends_at]
    end

    add_column :trip_items, :pickup_time, :string
    add_check_constraint :trip_items, "pickup_time ~ '^([01][0-9]|2[0-3]):(00|30)$'", name: "trip_items_pickup_time_check"

    change_table :vehicle_rates, bulk: true do |t|
      t.integer :pickup_from_hour, default: 7, null: false
      t.integer :pickup_until_hour, default: 19, null: false
      t.integer :turnaround_minutes, default: 0, null: false
      t.check_constraint "pickup_from_hour >= 0 AND pickup_until_hour <= 23 AND pickup_from_hour <= pickup_until_hour",
        name: "vehicle_rates_pickup_hours_check"
      t.check_constraint "turnaround_minutes >= 0 AND turnaround_minutes <= 720 AND turnaround_minutes % 30 = 0",
        name: "vehicle_rates_turnaround_check"
    end

    reversible do |dir|
      dir.up do
        execute <<~SQL
          UPDATE bookings SET
            starts_at = (bookings.starts_on + time '09:00') AT TIME ZONE 'Asia/Manila',
            ends_at = (bookings.starts_on + time '09:00') AT TIME ZONE 'Asia/Manila'
              + greatest(bookings.ends_on - bookings.starts_on, 1) * interval '1 day'
          FROM listings, categories
          WHERE listings.id = bookings.listing_id AND categories.id = listings.category_id
            AND categories.attribute_schema -> 'properties' ?& array['make', 'model', 'engine_cc']
        SQL
      end
    end
  end
end
