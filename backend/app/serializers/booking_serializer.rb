# A guest's booking as they see it (RAA-132; the `guest_booking` schema in
# spec/swagger_helper.rb): what was booked, when, its status and what it cost, and what
# cancelling now would refund, and its history (events). Never the listing's location: that
# comes with the payment flow's reveal rule (SPEC.md, Trust). Preload ASSOCIATIONS.
module BookingSerializer
  CANCELLABLE = %w[requested accepted awaiting_payment confirmed].freeze
  ASSOCIATIONS = [ :checkout, :events, { listing: [ :area, { category: :parent }, :cover_photo ] } ].freeze

  def self.call(booking)
    listing = booking.listing
    {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      booking_mode: booking.booking_mode,
      starts_on: booking.starts_on,
      ends_on: booking.ends_on,
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      quantity: booking.quantity,
      guests: booking.guests,
      room_guests: booking.room_guests,
      pets: booking.pets,
      total_cents: booking.total_cents,
      to_be_agreed: booking.price_breakdown["to_be_agreed"] == true,
      cancellation_policy: booking.cancellation_policy,
      expires_at: booking.expires_at,
      confirmed_at: booking.confirmed_at,
      cancelled_at: booking.cancelled_at,
      cancelled_by: booking.cancelled_by,
      refund_cents: booking.refund_cents,
      cancellable: CANCELLABLE.include?(booking.status),
      refund_if_cancelled_cents: CANCELLABLE.include?(booking.status) ? Bookings::Cancel.refund_cents(booking, by: "guest") : nil,
      free_cancellation_until: Bookings::Cancel.free_until(booking),
      trip_id: booking.checkout&.trip_id,
      trip_item_id: booking.trip_item_id,
      booking_type: listing.category.booking_type,
      area: { slug: listing.area.slug, name: listing.area.name },
      listing: ListingSummarySerializer.call(listing),
      created_at: booking.created_at,
      events: booking.events.map { event(_1) }
    }
  end

  def self.event(event)
    { from_status: event.from_status, to_status: event.to_status, actor: event.actor, reason: event.reason,
      created_at: event.created_at }
  end

  # What a trip item shows of its booking: with what it costs and its pay-by time, so the cart
  # can offer to pay for one held for payment (RAA-143).
  def self.brief(booking)
    booking && { id: booking.id, reference: booking.reference, status: booking.status,
                 total_cents: booking.total_cents, to_be_agreed: booking.price_breakdown["to_be_agreed"] == true,
                 expires_at: booking.expires_at }
  end
end
