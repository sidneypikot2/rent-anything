# One of a shop's delivery zones (RAA-205): up to max_distance_m from the listing's pin, in a
# straight line, delivery and pick-up each cost fee_cents a vehicle (0 free). VehicleRate holds
# them in order and refuses a farther zone that costs less.
class VehicleDeliveryZone < ApplicationRecord
  MIN_DISTANCE_M = 100
  MAX_DISTANCE_M = 50_000

  belongs_to :vehicle_rate, inverse_of: :delivery_zones

  validates :max_distance_m, numericality: { only_integer: true, in: MIN_DISTANCE_M..MAX_DISTANCE_M }
  validates :fee_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
end
