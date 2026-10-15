# Joiner tours sell seats (RAA-119): a joiner tour's capacity is max_guests × max_groups_per_day,
# up to 100 × 100, so a day's units on sale can pass 100, and a booking takes up to a full group
# of TourDetail::MAX_GUESTS joiners.
class WidenCalendarQuantities < ActiveRecord::Migration[8.1]
  def change
    remove_check_constraint :listing_days, "units_available >= 0 AND units_available <= 100",
      name: "listing_days_units_check"
    add_check_constraint :listing_days, "units_available >= 0 AND units_available <= 10000",
      name: "listing_days_units_check"

    remove_check_constraint :bookings, "quantity >= 1 AND quantity <= 99", name: "bookings_quantity_check"
    add_check_constraint :bookings, "quantity >= 1 AND quantity <= 100", name: "bookings_quantity_check"
  end
end
