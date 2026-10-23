# A listing on a guest's map (the `listing_pin` schema in spec/swagger_helper.rb): the
# summary plus its location rounded to two decimals, about 1 km, its booking type (the pin's
# colour) and its price once it has one (the pin's label). The exact point is revealed only
# after a paid booking. Preload category with its parent, stay_rate and tour_detail.
module ListingPinSerializer
  INCLUDES = [ { category: :parent }, :area, :cover_photo, :stay_rate, :tour_detail ].freeze

  def self.call(listing)
    ListingSummarySerializer.call(listing).merge(
      location: { lat: listing.location.y.round(2), lng: listing.location.x.round(2) },
      booking_type: listing.category.booking_type,
      price_from_cents: PricingSerializer.price_from_cents(listing),
      price_unit: PricingSerializer.price_unit(listing)
    )
  end
end
