# A guest's trip with its items in date order, undated last (the `trip` schema in
# spec/swagger_helper.rb). destinations are the places its items are in (Trips::Destination),
# in item order, and each item names its own, which the cart groups a multi-place trip by.
# Each item has its booking while one holds its days (RAA-132), the listing's cancellation policy and whether it can still be booked (RAA-139), and a stay the guests it
# sleeps (Listing#sleeps). An unbooked dated item says why the listing can't have it on its
# dates (`unavailable`, from the partner's calendar), so the guest can pick another rather
# than finding out at checkout; it stays in the trip either way. Pass one cache when
# serializing several trips: each area's destination walks the area tree.
module TripSerializer
  def self.call(trip, destinations: destination_cache)
    ledger = ledger(trip.items)
    {
      id: trip.id,
      name: trip.name,
      starts_on: trip.starts_on&.iso8601,
      ends_on: trip.ends_on&.iso8601,
      guests: trip.guests,
      destinations: trip.items.filter_map { |item| destinations[item.listing.area]&.name }.uniq,
      updated_at: trip.updated_at.iso8601,
      deletes_on: trip.deletes_on&.iso8601,
      items: trip.items.map { |item| item(item, ledger, destinations) }
    }
  end

  # One trip, read again with its items, listings and areas in a few queries.
  def self.reloaded(trip)
    call(Trip.with_items.find(trip.id))
  end

  def self.destination_cache
    Hash.new { |cache, area| cache[area] = Trips::Destination.for(area) }
  end

  # One calendar read for the trip's items that are still to come and not yet booked.
  def self.ledger(items)
    open = items.select { |item| open?(item) }
    return if open.empty?

    Availability::Ledger.new(open.map(&:listing).uniq, open.map(&:starts_on).min, open.map(&:ends_on).max)
  end

  def self.open?(item)
    item.starts_on && item.ends_on >= Date.current && !item.booking
  end

  # Why the listing can't take the item on its days still ahead, or nil when it can: a day
  # the partner blocked or one with nothing left. Room for fewer guests than the item's is not
  # it (the trip card's stay gaps say that), so one unit left is enough.
  def self.unavailable(item, ledger)
    return unless open?(item)

    listing = item.listing
    return "No longer offered" unless listing.active?

    days = Booking.days_for(listing.category.accommodation?, item.starts_on, item.ends_on).select { _1 >= Date.current }
    ledger.refusal(listing, days, 1)
  end

  def self.item(item, ledger, destinations)
    destination = destinations[item.listing.area]
    {
      id: item.id,
      starts_on: item.starts_on&.iso8601,
      ends_on: item.ends_on&.iso8601,
      quantity: item.quantity,
      sleeps: item.listing.sleeps,
      booking_type: item.listing.category.booking_type,
      area: { slug: item.listing.area.slug, name: item.listing.area.name },
      destination: destination && { slug: destination.slug, name: destination.name },
      listing: ListingSummarySerializer.call(item.listing),
      booking: BookingSerializer.brief(item.booking),
      unavailable: unavailable(item, ledger),
      cancellation_policy: item.listing.cancellation_policy,
      listing_active: item.listing.active?
    }
  end
  private_class_method :ledger, :open?, :unavailable, :item
end
