# Plan a whole trip (2026-11-02): where the guest is staying when they booked it outside the app,
# as a pin they dropped on the map and an optional name. The planner measures distances from it;
# a stay booked in the app has its listing's own point instead.
class AddOwnStayToTrips < ActiveRecord::Migration[8.1]
  def change
    add_column :trips, :stay_location, :geography, limit: { srid: 4326, type: "st_point", geographic: true }
    add_column :trips, :stay_name, :string
    add_check_constraint :trips, "stay_name IS NULL OR char_length(stay_name::text) <= 120", name: "trips_stay_name_length_check"
    add_check_constraint :trips, "stay_name IS NULL OR stay_location IS NOT NULL", name: "trips_stay_name_needs_location_check"
  end
end
