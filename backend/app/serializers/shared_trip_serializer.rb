# A trip as its share link shows it (RAA-176, the `shared_trip` schema in
# spec/swagger_helper.rb): what the trip is and where it goes, for friends to look at. Never
# prices, the guest's name or contact details, booking references, or the trip's and items'
# ids; the listing's id only links to its public page. Preload with Trip.with_items.
module SharedTripSerializer
  def self.call(trip)
    destinations = TripSerializer.destination_cache
    {
      name: trip.name,
      starts_on: trip.starts_on&.iso8601,
      ends_on: trip.ends_on&.iso8601,
      guests: trip.guests,
      destinations: trip.items.filter_map { |item| destinations[item.listing.area]&.name }.uniq,
      items: trip.items.map { |item| item(item) }
    }
  end

  def self.item(item)
    listing = item.listing
    {
      starts_on: item.starts_on&.iso8601,
      ends_on: item.ends_on&.iso8601,
      booking_type: listing.category.booking_type,
      area: { slug: listing.area.slug, name: listing.area.name },
      listing: { id: listing.id, title: listing.title, cover_photo_url: ListingPhotoSerializer.cover_url(listing) },
      booking_status: item.booking&.status
    }
  end
  private_class_method :item
end
