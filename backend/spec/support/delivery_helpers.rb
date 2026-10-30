# Delivery zones (RAA-205): a vehicle rate's zones as [metres, fee] pairs, and a guest's pin some
# metres north of a listing's.
module DeliveryHelpers
  def deliver_within(rate, zones, delivers: true, picks_up: true)
    rate.assign_delivery(delivers:, picks_up:, zones: zones.map { |metres, fee| { max_distance_m: metres, fee_cents: fee } })
    rate.save!
  end

  def pin_north_of(listing, metres)
    { lat: listing.location.y + (metres / 110_600.0), lng: listing.location.x }
  end
end

RSpec.configure { |config| config.include DeliveryHelpers }
