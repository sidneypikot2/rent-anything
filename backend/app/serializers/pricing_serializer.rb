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

  # What a guest sees on a listing row: the nightly price once one is set, else null.
  def self.price_from_cents(listing)
    rate = listing.stay_rate
    rate&.priced? ? rate.nightly_price_cents : nil
  end
end
