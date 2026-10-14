# A listing's pricing (RAA-104), the same for its partner and for guests (the `stay_rate`
# and `listing_fee` schemas in spec/swagger_helper.rb). Preload stay_rate and fees.
module PricingSerializer
  STAY_RATE_FIELDS = %w[
    nightly_price_cents weekend_price_cents base_guests extra_guest_fee_cents weekly_discount_percent
    monthly_discount_percent min_nights max_nights
  ].freeze

  def self.stay_rate(rate)
    rate&.slice(*STAY_RATE_FIELDS)&.symbolize_keys
  end

  def self.fees(listing)
    listing.fees.map do |fee|
      { id: fee.id, name: fee.name, amount_cents: fee.amount_cents, charged_per: fee.charged_per, required: fee.required }
    end
  end

  # What a guest sees on a listing row: a stay's nightly price or a tour's base price
  # (RAA-110) once one is set, else null. Preload stay_rate and tour_detail.
  def self.price_from_cents(listing)
    rate = listing.stay_rate
    return rate.nightly_price_cents if rate&.priced?

    tour = listing.tour_detail
    tour&.priced? ? tour.base_price_cents : nil
  end

  # What price_from_cents is for: "night", a private tour's "group" or a joiner's "person".
  def self.price_unit(listing)
    return "night" if listing.stay_rate&.priced?

    tour = listing.tour_detail
    tour&.priced? ? tour.price_unit : nil
  end
end
