module Partners
  # What a partner's dashboard shows (RAA-266; PartnerDashboardSerializer). "Today" and "this
  # month" are Manila's: in UTC it is still yesterday there before 8am. The calendar's own dates
  # stay UTC (bookings.md). The ID check is the stored one, as Verifications::Current would ask
  # Didit on every load.
  class Dashboard < ApplicationService
    LIMIT = 5
    ACTIVITY_LIMIT = 10
    # Firm bookings: an accepted request waiting for payment may yet expire.
    UPCOMING = %w[confirmed in_progress].freeze
    LISTING_ASSOCIATIONS = [ :category, :stay_rate, :vehicle_rate, :flat_rate, :photos, :tour_detail, :visited_landmarks ].freeze
    BOOKING_ASSOCIATIONS = { listing: %i[category tour_detail] }.freeze

    def initialize(partner)
      @partner = partner
      @today = ActiveSupport::TimeZone[Booking::RENTAL_TIME_ZONE].today
    end

    def call
      listings = @partner.listings.where.not(status: "delisted").includes(*LISTING_ASSOCIATIONS).order(:title, :id).to_a
      {
        requests_waiting: open_requests.count,
        arriving_today: bookings.where(status: UPCOMING, starts_on: @today).count,
        listings_live: listings.count(&:active?),
        estimated_earnings_cents: Earnings.call(@partner, { month: @today.strftime("%Y-%m") })[:estimate_cents],
        requests: open_requests.includes(BOOKING_ASSOCIATIONS).order(Booking.arel_table[:expires_at].asc.nulls_last, :id).limit(LIMIT),
        upcoming: bookings.where(status: UPCOMING, starts_on: @today..).includes(BOOKING_ASSOCIATIONS).order(:starts_on, :id).limit(LIMIT),
        listings_needing_attention: listings.select { !_1.active? || _1.live_blockers.any? },
        verification: @partner.partner_verification,
        profile_complete: @partner.partner_profile.present? && @partner.phone.present?,
        business: @partner.businesses.exists?,
        payout_account: @partner.payout_accounts.exists?,
        activity: activity
      }
    end

    private

    def bookings
      Booking.of_partner(@partner)
    end

    # Not yet past their answer-by time: Bookings::Expire only comes round every few minutes.
    def open_requests
      bookings.requested.where("bookings.expires_at IS NULL OR bookings.expires_at > ?", Time.current)
    end

    def activity
      BookingEvent.where(booking: bookings).includes(booking: :listing).order(created_at: :desc, id: :desc).limit(ACTIVITY_LIMIT)
    end
  end
end
