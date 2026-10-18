module Bookings
  # Expires the bookings whose time ran out (RAA-132): a request its partner didn't answer
  # within Booking::REQUEST_TTL (or by its start), and a hold not paid within
  # Booking::PAYMENT_TTL. Their days are freed. Run by Bookings::ExpireJob. Returns how many
  # it expired.
  class Expire < ApplicationService
    def initialize(now = Time.current)
      @now = now
    end

    def call
      Booking.where(status: Booking::PENDING, expires_at: ..@now).find_each.count do |booking|
        Booking.transaction do
          booking.lock!
          # Answered or paid since the query.
          next false unless booking.pending? && booking.expires_at&.<=(@now)

          Transition.call(booking, "expired", actor: "system",
            reason: booking.requested? ? "Not answered in time" : "Not paid in time")
          true
        end
      end
    end
  end
end
