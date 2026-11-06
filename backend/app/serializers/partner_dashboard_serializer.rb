# A partner's dashboard (RAA-266; the `partner_dashboard` schema in spec/swagger_helper.rb), from
# Partners::Dashboard. An activity row says who acted (admin being the team answering for the
# partner) but never the event's reason or metadata, which are the team's and the system's own.
module PartnerDashboardSerializer
  def self.call(data)
    {
      tiles: data.slice(:requests_waiting, :arriving_today, :listings_live, :estimated_earnings_cents),
      requests: data[:requests].map { PartnerCalendarSerializer.booking(_1) },
      upcoming: data[:upcoming].map { PartnerCalendarSerializer.booking(_1) },
      listings_needing_attention: data[:listings_needing_attention].map { listing(_1) },
      setup: setup(data),
      activity: data[:activity].map { event(_1) }
    }
  end

  def self.listing(listing)
    { id: listing.id, title: listing.title, status: listing.status, live_blockers: listing.live_blockers }
  end

  def self.setup(data)
    verification = data[:verification]
    {
      id_check_status: verification&.status || "not_started",
      id_check: verification&.approved? || false,
      profile: data[:profile_complete],
      business: data[:business],
      payout_account: data[:payout_account]
    }
  end

  def self.event(event)
    booking = event.booking
    {
      id: event.id, booking_id: booking.id, reference: booking.reference, guest_name: booking.guest_name,
      listing_id: booking.listing_id, listing_title: booking.listing.title, from_status: event.from_status,
      to_status: event.to_status, actor: event.actor, created_at: event.created_at
    }
  end
end
