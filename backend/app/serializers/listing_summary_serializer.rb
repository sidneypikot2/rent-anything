# A listing as guests see it in search and on an area page (the `listing_summary` schema in
# spec/swagger_helper.rb). Never the location: the exact point is revealed only after a
# paid booking.
module ListingSummarySerializer
  def self.call(listing)
    { id: listing.id, title: listing.title, category: listing.category.name, area_slug: listing.area.slug }
  end
end
