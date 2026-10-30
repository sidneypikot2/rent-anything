# Child helmets for motorcycle rentals (RAA-205): a shop offers them free (0, an inclusion) or
# for a fee per helmet and day, or not at all (null). A trip item keeps how many the guest wants
# and a booking copies it at checkout.
class AddChildHelmetsToMotorcycleRentals < ActiveRecord::Migration[8.1]
  def change
    change_table :vehicle_rates, bulk: true do |t|
      t.bigint :child_helmet_fee_cents
      t.check_constraint "child_helmet_fee_cents >= 0", name: "vehicle_rates_child_helmet_fee_check"
    end
    %i[trip_items bookings].each do |table|
      change_table table, bulk: true do |t|
        t.integer :child_helmets, default: 0, null: false
        t.check_constraint "child_helmets >= 0", name: "#{table}_child_helmets_check"
      end
    end
  end
end
