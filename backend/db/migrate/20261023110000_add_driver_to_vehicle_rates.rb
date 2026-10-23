# Driving a vehicle rental (RAA-150): a car, van, multicab or tricycle can be self-drive only,
# come with a driver only, or either, the driver at a fee per day. A motorcycle is always
# self-drive (VehicleRate). Every existing rate is self-drive, as it was.
class AddDriverToVehicleRates < ActiveRecord::Migration[8.1]
  def change
    add_column :vehicle_rates, :driving, :string, null: false, default: "self_drive"
    add_column :vehicle_rates, :driver_fee_cents, :bigint
    add_check_constraint :vehicle_rates, "driving IN ('self_drive', 'with_driver', 'either')",
      name: "vehicle_rates_driving_check"
    add_check_constraint :vehicle_rates, "driver_fee_cents > 0", name: "vehicle_rates_driver_fee_check"
    add_check_constraint :vehicle_rates, "(driving = 'self_drive') = (driver_fee_cents IS NULL)",
      name: "vehicle_rates_driver_fee_needs_driver_check"
  end
end
