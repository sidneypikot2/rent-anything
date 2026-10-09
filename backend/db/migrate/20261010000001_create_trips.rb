# Trips (RAA-64): the cart is a list of trips, not one cart per area. A trip is a guest's
# named, dated group of items from any area; an item is one listing with its own dates.
# Dates are both set or both empty. Bookings and payments come with checkout.
class CreateTrips < ActiveRecord::Migration[8.1]
  def change
    create_table :trips do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.string :name, null: false
      t.date :starts_on
      t.date :ends_on
      t.integer :guests, null: false, default: 1
      t.timestamps

      t.index %i[user_id updated_at]
      t.check_constraint "char_length(name) BETWEEN 1 AND 80", name: "trips_name_length_check"
      t.check_constraint "guests BETWEEN 1 AND 50", name: "trips_guests_check"
      t.check_constraint "(starts_on IS NULL) = (ends_on IS NULL)", name: "trips_dates_both_or_neither_check"
      t.check_constraint "ends_on >= starts_on", name: "trips_dates_order_check"
    end

    create_table :trip_items do |t|
      t.references :trip, null: false, foreign_key: { on_delete: :cascade }
      # A deleted listing leaves the trips it was in; nothing in a trip is booked yet.
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }
      t.date :starts_on
      t.date :ends_on
      t.integer :quantity, null: false, default: 1
      # Did the guest add it to the trip we suggested (decision 13)? Set false when the item
      # is later moved to another trip.
      t.boolean :followed_suggestion
      t.timestamps

      t.check_constraint "quantity BETWEEN 1 AND 99", name: "trip_items_quantity_check"
      t.check_constraint "(starts_on IS NULL) = (ends_on IS NULL)", name: "trip_items_dates_both_or_neither_check"
      t.check_constraint "ends_on >= starts_on", name: "trip_items_dates_order_check"
    end
  end
end
