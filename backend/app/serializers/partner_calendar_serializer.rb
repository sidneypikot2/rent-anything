# A partner's calendar (RAA-118; the `partner_calendar`, `calendar_listing`, `calendar_day`,
# `availability_block` and `booking` schemas in spec/swagger_helper.rb): each listing with its
# days in the window, and the blocks and confirmed bookings that touch it.
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
      days: (from..to).map { |date| ledger.day(listing, date) },
      blocks: ledger.blocks(listing).map { block(_1) },
      bookings: ledger.bookings(listing).map { booking(_1) }
    }
  end

  def self.block(block)
    { id: block.id, starts_on: block.starts_on, ends_on: block.ends_on, reason: block.reason }
  end

  def self.booking(booking)
    booking.slice(:id, :guest_name, :starts_on, :ends_on, :quantity, :status, :source, :total_cents, :notes,
      :created_at).symbolize_keys
  end
end
