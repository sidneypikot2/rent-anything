# A listing on a guest's map (the `listing_pin` schema in spec/swagger_helper.rb): the
# summary plus its location rounded to two decimals, about 1 km. The exact point is
# revealed only after a paid booking.
module ListingPinSerializer
  def self.call(listing)
    ListingSummarySerializer.call(listing).merge(
      location: { lat: listing.location.y.round(2), lng: listing.location.x.round(2) }
    )
  end
end
