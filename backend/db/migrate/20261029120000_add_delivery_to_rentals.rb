# Delivery and pick-up for vehicle rentals (RAA-195): a guest can have the vehicle brought to
# them and/or collected from them at the end, where the shop offers it (VehicleRate's fees), to
# an address they type. A trip item keeps the choice and a booking copies it at checkout.
class AddDeliveryToRentals < ActiveRecord::Migration[8.1]
  def change
    %i[trip_items bookings].each do |table|
      change_table table, bulk: true do |t|
        t.boolean :delivery, default: false, null: false
        t.boolean :return_pickup, default: false, null: false
        t.string :delivery_address
        t.check_constraint "char_length(delivery_address) <= 200", name: "#{table}_delivery_address_length_check"
        t.check_constraint "(delivery OR return_pickup) = (delivery_address IS NOT NULL)", name: "#{table}_delivery_address_check"
      end
    end
  end
end
