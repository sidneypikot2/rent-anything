# A listing's pricing (RAA-104), the same for its partner and for guests (the `stay_rate`,
# `vehicle_rate` and `listing_fee` schemas in spec/swagger_helper.rb). Preload stay_rate,
# vehicle_rate and fees.
module PricingSerializer
  STAY_RATE_FIELDS = %w[
    nightly_price_cents weekend_price_cents base_guests extra_guest_fee_cents weekly_discount_percent
    monthly_discount_percent min_nights max_nights
  ].freeze
  VEHICLE_RATE_FIELDS = %w[
    daily_price_cents half_day_price_cents half_day_hours hourly_price_cents weekly_price_cents monthly_price_cents
    security_deposit_cents delivery_fee_cents return_pickup_fee_cents min_rental_days km_limit_per_day
    excess_km_fee_cents driving driver_fee_cents
  ].freeze

  def self.stay_rate(rate)
    rate&.slice(*STAY_RATE_FIELDS)&.symbolize_keys
  end

  def self.vehicle_rate(rate)
    rate&.slice(*VEHICLE_RATE_FIELDS)&.symbolize_keys
  end

  def self.fees(listing)
    listing.fees.map do |fee|
      { id: fee.id, name: fee.name, amount_cents: fee.amount_cents, charged_per: fee.charged_per, required: fee.required }
    end
  end

  # What a guest sees on a listing row: a stay's nightly price, a tour's base price (RAA-110)
  # or a vehicle's daily price (RAA-149) once one is set, else null. Preload stay_rate,
  # tour_detail and vehicle_rate.
  def self.price_from_cents(listing)
    rate = listing.stay_rate
    return rate.nightly_price_cents if rate&.priced?

    vehicle = listing.vehicle_rate
    return vehicle.daily_price_cents if vehicle&.priced?

    tour = listing.tour_detail
    tour&.priced? ? tour.base_price_cents : nil
  end

  # What price_from_cents is for: "night", a private tour's "group", a joiner's "person" or
  # a vehicle's "day".
  def self.price_unit(listing)
    return "night" if listing.stay_rate&.priced?
    return "day" if listing.vehicle_rate&.priced?

    tour = listing.tour_detail
    tour&.priced? ? tour.price_unit : nil
  end
end
