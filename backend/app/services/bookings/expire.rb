module Bookings
  # Expires the bookings whose time ran out (RAA-132): a request its partner didn't answer
  # within Booking::REQUEST_TTL (or by its start), and a hold not paid within
  # Booking::PAYMENT_TTL. Their days are freed. A hold with a PayMongo checkout open has it let
  # go first (Payments::Release), which confirms it instead if it was paid meanwhile; one whose
  # payment is still going through, or whose checkout PayMongo couldn't be reached to end, is
  # left for the next run. Run by Bookings::ExpireJob. Returns how many it expired.
  class Expire < ApplicationService
    def initialize(now = Time.current)
      @now = now
    end

    def call
      Booking.where(status: Booking::PENDING, expires_at: ..@now).find_each.count do |booking|
        next false unless release_checkouts(booking)

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

    private

    # Outside the booking's transaction, as PayMongo is called. False while one stays open.
    def release_checkouts(booking)
      Payment.open_checkouts.covering([ booking.id ]).each { Payments::Release.call(_1) }.none?(&:pending?)
    rescue Paymongo::Error => e
      Sentry.capture_exception(e)
      false
    end
  end
end
