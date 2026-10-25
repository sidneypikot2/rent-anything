# A booking as the team sees it when answering for its partner (RAA-141; the `admin_booking`
# schema in spec/swagger_helper.rb): the partner's view of it (PartnerCalendarSerializer)
# plus its booking type, area, partner and business, and its traveller's contact details
# (none for one taken offline), as the booking keeps them: an unregistered guest's account is
# deleted after their trip (RAA-175), and user_id is then null.
module AdminBookingSerializer
  def self.call(booking)
    listing = booking.listing
    partner = listing.partner
    PartnerCalendarSerializer.booking(booking, listing).merge(
      booking_type: listing.category.booking_type,
      cancellation_policy: booking.cancellation_policy,
      responded_at: booking.responded_at,
      listing: { id: listing.id, title: listing.title, area: listing.area.name },
      partner: { id: partner.id, name: partner.name, email: partner.email, phone: partner.phone,
        business: listing.business.name },
      traveller: booking.source_checkout? ? traveller(booking) : nil
    )
  end

  def self.traveller(booking)
    { id: booking.user_id, name: booking.guest_name, email: booking.guest_email, phone: booking.guest_phone }
  end
end
