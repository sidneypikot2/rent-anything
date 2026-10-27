# Multi-room stays (RAA-182): a party is adults, children and infants, and may bring pets.
# A trip keeps its party (guests stays the whole party, so at least one of them is an
# adult); a stay's trip item and its booking keep how the party is split across rooms
# (room_guests, a list of { adults, children, infants }, null when split evenly as before)
# and its pets. Fees may now be charged per pet or per pet per night, once per stay.
class AddPartyToTripsAndBookings < ActiveRecord::Migration[8.1]
  OLD_CHARGED_PER = "charged_per IN ('booking', 'night', 'guest', 'guest_night', 'unit', 'day', 'hour')"
  NEW_CHARGED_PER = "charged_per IN ('booking', 'night', 'guest', 'guest_night', 'unit', 'day', 'hour', 'pet', 'pet_night')"

  def change
    add_column :trips, :children, :integer, null: false, default: 0
    add_column :trips, :infants, :integer, null: false, default: 0
    add_column :trips, :pets, :integer, null: false, default: 0
    add_check_constraint :trips, "children BETWEEN 0 AND 49 AND infants BETWEEN 0 AND 49 AND children + infants < guests",
      name: "trips_party_check"
    add_check_constraint :trips, "pets BETWEEN 0 AND 20", name: "trips_pets_check"

    %i[trip_items bookings].each do |table|
      add_column table, :room_guests, :jsonb
      add_column table, :pets, :integer, null: false, default: 0
      add_check_constraint table,
        "room_guests IS NULL OR (jsonb_typeof(room_guests) = 'array' AND jsonb_array_length(room_guests) BETWEEN 1 AND 99)",
        name: "#{table}_room_guests_check"
      add_check_constraint table, "pets BETWEEN 0 AND 20", name: "#{table}_pets_check"
    end

    reversible do |dir|
      dir.up { replace_charged_per_check(NEW_CHARGED_PER) }
      dir.down do
        execute "DELETE FROM listing_fees WHERE charged_per IN ('pet', 'pet_night')"
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
