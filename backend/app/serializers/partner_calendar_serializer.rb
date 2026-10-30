# A partner's calendar (RAA-118; the `partner_calendar`, `calendar_listing`, `calendar_day`,
# `availability_block` and `booking` schemas in spec/swagger_helper.rb): each listing with its
# days in the window, and the blocks and the bookings holding days that touch it.
module PartnerCalendarSerializer
  def self.call(from:, to:, listings:, ledger:)
    { from:, to:, listings: listings.map { |listing| listing(listing, ledger, from, to) } }
  end

  def self.listing(listing, ledger, from, to)
    category = listing.category
    {
      id: listing.id,
      title: listing.title,
      status: listing.status,
      business: { id: listing.business.id, name: listing.business.name },
      category: { id: category.id, slug: category.slug, name: category.name, booking_type: category.booking_type },
      tour_type: listing.tour_detail&.tour_type,
      capacity: Availability::Ledger.capacity(listing),
      capacity_unit: Availability::Ledger.capacity_unit(listing),
      price_unit: PricingSerializer.price_unit(listing),
      turnaround_minutes: listing.vehicle_rate&.turnaround_minutes,
      days: (from..to).map { |date| ledger.day(listing, date) },
      blocks: ledger.blocks(listing).map { block(_1) },
      bookings: ledger.bookings(listing).map { booking(_1, listing) }
    }
  end

  def self.block(block)
    { id: block.id, starts_on: block.starts_on, ends_on: block.ends_on, reason: block.reason }
  end

  # A booking as its partner sees it: a pending one (Booking::PENDING) holds its days until it
  # is answered, paid or expires at expires_at. commission_cents is the platform's share. A stay's
  # room_guests and pets show how its guests split into rooms and what pets come (RAA-182). A
  # vehicle rental's starts_at and ends_at are its pickup and return (RAA-195), nil for anything else,
  # and delivery / return_pickup whether the shop brings it and collects it, to delivery_address.
  def self.booking(booking, listing = booking.listing)
    booking.slice(:id, :reference, :guest_name, :guest_email, :guest_phone, :starts_on, :ends_on, :starts_at, :ends_at, :quantity, :guests,
      :room_guests, :pets, :delivery, :return_pickup, :delivery_address, :child_helmets, :status, :source, :booking_mode, :total_cents, :commission_cents, :refund_cents, :cancelled_by,
      :expires_at, :notes, :created_at).symbolize_keys.merge(to_be_agreed: booking.price_breakdown["to_be_agreed"] == true,
        listing: { id: listing.id, title: listing.title })
  end
end
