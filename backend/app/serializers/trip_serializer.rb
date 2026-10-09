# A guest's trip with its items in date order, undated last (the `trip` schema in
# spec/swagger_helper.rb). destinations are the places its items are in (Trips::Destination),
# in item order. Pass one cache when serializing several trips: each area's destination
# walks the area tree.
module TripSerializer
  def self.call(trip, destinations: destination_cache)
    {
      id: trip.id,
      name: trip.name,
      starts_on: trip.starts_on&.iso8601,
      ends_on: trip.ends_on&.iso8601,
      guests: trip.guests,
      destinations: trip.items.filter_map { |item| destinations[item.listing.area]&.name }.uniq,
      updated_at: trip.updated_at.iso8601,
      items: trip.items.map { |item| item(item) }
    }
  end

  # One trip, read again with its items, listings and areas in a few queries.
  def self.reloaded(trip)
    call(Trip.with_items.find(trip.id))
  end

  def self.destination_cache
    Hash.new { |cache, area| cache[area] = Trips::Destination.for(area) }
  end

  def self.item(item)
    {
      id: item.id,
      starts_on: item.starts_on&.iso8601,
      ends_on: item.ends_on&.iso8601,
      quantity: item.quantity,
      area: { slug: item.listing.area.slug, name: item.listing.area.name },
      listing: ListingSummarySerializer.call(item.listing)
    }
  end
  private_class_method :item
end
