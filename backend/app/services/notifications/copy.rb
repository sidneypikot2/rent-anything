module Notifications
  # Each kind of notification: who gets it, whether it is emailed too, and its wording and
  # link, made from the values saved with it (`params`), so changing a sentence here changes
  # it for old notifications as well. Links are web app paths.
  #
  # A guest's links go to the cart while a booking is being asked for or paid (they pay from
  # it, RAA-143) and to Booked trips once it is confirmed; a partner's open the booking on
  # their calendar.
  module Copy
    TIME_ZONE = "Asia/Manila"

    # kind => [recipient, emailed?]
    CATALOGUE = {
      "booking.requested" => [ :partner, true ],
      "booking.change_requested" => [ :partner, true ],
      "booking.request_reminder" => [ :partner, true ],
      "booking.request_expired" => [ :partner, false ],
      "booking.paid" => [ :partner, true ],
      "booking.guest_cancelled" => [ :partner, true ],
      "booking.payment_expired" => [ :partner, false ],
      "booking.accepted" => [ :guest, true ],
      "booking.payment_reminder" => [ :guest, true ],
      "booking.confirmed" => [ :guest, true ],
      "booking.declined" => [ :guest, true ],
      "booking.cancelled" => [ :guest, true ],
      "booking.request_unanswered" => [ :guest, false ],
      "booking.hold_expired" => [ :guest, false ],
      "booking.starts_tomorrow" => [ :guest, true ]
    }.freeze
    KINDS = CATALOGUE.keys.freeze

    # The values a booking's notifications need, saved with each one.
    def self.booking_params(booking, **extra)
      {
        listing_title: booking.listing.title,
        guest_name: booking.guest_name,
        reference: booking.reference,
        starts_on: booking.starts_on.iso8601,
        ends_on: booking.ends_on.iso8601,
        expires_at: booking.expires_at&.iso8601,
        trip_id: booking.checkout&.trip_id,
        refund_cents: booking.refund_cents
      }.merge(extra)
    end

    def self.email?(kind)
      CATALOGUE.fetch(kind).last
    end

    def self.recipient(kind)
      CATALOGUE.fetch(kind).first
    end

    # { title:, body:, path: } for a notification.
    def self.call(notification)
      Text.new(notification).to_h
    end

    class Text
      def initialize(notification)
        @kind = notification.kind
        @p = notification.params
        @subject_id = notification.subject_id
      end

      def to_h
        title, body = words
        { title:, body:, path: }
      end

      private

      def listing = @p["listing_title"]
      def guest = @p["guest_name"]

      def words
        case @kind
        when "booking.requested" then [ "New request: #{listing}", "#{guest} asked for #{dates}. Answer by #{deadline}." ]
        when "booking.change_requested" then [ "New dates asked for: #{listing}", "#{guest} changed their booking to #{dates}. Answer by #{deadline}." ]
        when "booking.request_reminder" then [ "Answer soon: #{listing}", "#{guest}'s request for #{dates} expires at #{deadline}." ]
        when "booking.request_expired" then [ "Request expired: #{listing}", "#{guest}'s request for #{dates} wasn't answered in time. The dates are free again." ]
        when "booking.paid" then [ "Booking confirmed: #{listing}", "#{guest} paid for #{dates}. Reference #{@p['reference']}." ]
        when "booking.guest_cancelled" then [ "#{guest} cancelled: #{listing}", "The booking for #{dates} is cancelled and the dates are free again." ]
        when "booking.payment_expired" then [ "Not paid in time: #{listing}", "#{guest} didn't pay for #{dates} in time. The dates are free again." ]
        when "booking.accepted" then [ "Request accepted: #{listing}", "Pay by #{deadline} to confirm #{dates}." ]
        when "booking.payment_reminder" then [ "Pay soon: #{listing}", "Your hold on #{dates} ends at #{deadline}. Pay to keep it." ]
        when "booking.confirmed" then [ "Booking confirmed: #{listing}", "You're booked for #{dates}. Reference #{@p['reference']}." ]
        when "booking.declined" then [ "Request declined: #{listing}", "The partner can't take #{dates}.#{refund} Pick something else for your trip." ]
        when "booking.cancelled" then [ "Booking cancelled: #{listing}", "The partner cancelled #{dates}.#{refund}" ]
        when "booking.request_unanswered" then [ "Request expired: #{listing}", "The partner didn't answer in time for #{dates}. Pick something else for your trip." ]
        when "booking.hold_expired" then [ "Hold expired: #{listing}", "#{dates} wasn't paid for in time, so the hold was let go." ]
        when "booking.starts_tomorrow" then [ "Tomorrow: #{listing}", "#{dates}. Reference #{@p['reference']}." ]
        end
      end

      def path
        return "/partner/calendar?booking=#{@subject_id}" if Copy.recipient(@kind) == :partner

        trip = @p["trip_id"]
        booked = %w[booking.confirmed booking.starts_tomorrow].include?(@kind)
        return (booked ? "/trips" : "/cart") unless trip

        booked ? "/trips?trip=#{trip}" : "/cart?trip=#{trip}"
      end

      # "Nov 12", "Nov 12–15" or "Nov 30 – Dec 2".
      def dates
        from = Date.iso8601(@p["starts_on"])
        to = Date.iso8601(@p["ends_on"])
        return from.strftime("%b %-d") if from == to
        return "#{from.strftime('%b %-d')}–#{to.strftime('%-d')}" if from.month == to.month && from.year == to.year

        "#{from.strftime('%b %-d')} – #{to.strftime('%b %-d')}"
      end

      # "Nov 12, 3:00 PM", in the area's time (every area is in the Philippines so far).
      def deadline
        at = @p["expires_at"]
        at ? Time.iso8601(at).in_time_zone(TIME_ZONE).strftime("%b %-d, %-l:%M %p") : "the deadline"
      end

      def refund
        cents = @p["refund_cents"]
        cents&.positive? ? " Your payment of ₱#{ActiveSupport::NumberHelper.number_to_delimited(cents / 100)} will be refunded." : ""
      end
    end
  end
end
