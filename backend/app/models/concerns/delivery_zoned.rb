# Distance-priced delivery zones (RAA-205), shared by a vehicle rate and a water activity
# (RAA-271): each reaches max_distance_m from the listing's pin in a straight line and costs
# fee_cents (0 free). Nearest first, at most MAX_DELIVERY_ZONES, each a different distance, and a
# farther one never cheaper. The including model has_many :delivery_zones.
module DeliveryZoned
  extend ActiveSupport::Concern

  MAX_DELIVERY_ZONES = 5
  MIN_DISTANCE_M = 100
  MAX_DISTANCE_M = 50_000

  included do
    validate :zones_in_order
  end

  # Replaces the zones (max_distance_m and fee_cents each); saved with the record.
  def assign_zones(zones)
    delivery_zones.each(&:mark_for_destruction)
    zones.each { delivery_zones.build(_1) }
  end

  # The zone a point `distance_m` from the pin falls in, nil beyond the farthest.
  def zone_for(distance_m)
    zones.find { _1.max_distance_m >= distance_m }
  end

  def max_delivery_m
    zones.last&.max_distance_m
  end

  # The zones as they will be saved, nearest first.
  def zones
    delivery_zones.reject(&:marked_for_destruction?).sort_by { _1.max_distance_m.to_i }
  end

  private

  def zones_in_order
    list = zones
    errors.add(:delivery_zones, "can be at most #{MAX_DELIVERY_ZONES}") if list.size > MAX_DELIVERY_ZONES
    list.each_cons(2) do |near, far|
      next unless near.max_distance_m.is_a?(Integer) && far.max_distance_m.is_a?(Integer)

      errors.add(:delivery_zones, "can't end at the same distance") if near.max_distance_m == far.max_distance_m
      if near.fee_cents.is_a?(Integer) && far.fee_cents.is_a?(Integer) && far.fee_cents < near.fee_cents
        errors.add(:delivery_zones, "can't cost less farther from the shop")
      end
    end
  end
end
