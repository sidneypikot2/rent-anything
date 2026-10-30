module Notifications
  # Who hears about a booking's change of status, and what (Copy::CATALOGUE). Called by
  # Bookings::Transition for every change, from nil for a new booking, and by Bookings::Change
  # for a request whose details changed while it waited (requested to requested).
  #
  # Nothing for a booking the partner took offline (no guest, and they made it), an instant
  # hold (the guest is paying right then), or starting and completing. While requests are
  # accepted automatically (Bookings.auto_accept?) the partner hears of a booking once paid.
  class BookingChanged < ApplicationService
    def initialize(booking, from:, to:, actor:)
      @booking = booking
      @from = from
      @to = to
      @actor = actor
    end

    def call
      case [ @from, @to ]
      in [ nil, "requested" ] then partner("booking.requested") unless Bookings.auto_accept?
      in [ nil, _ ] then nil
      in [ _, "requested" ] then partner("booking.change_requested")
      # A changed booking paid already is confirmed on that payment straight away.
      in [ "accepted", "awaiting_payment" ] then guest("booking.accepted") unless @booking.payment_id
      in [ _, "confirmed" ]
        guest("booking.confirmed")
        partner("booking.paid") if first_confirmation?
      in [ "requested", "declined" ] then guest("booking.declined")
      in [ _, "cancelled" ]
        if @actor != "guest"
          guest("booking.cancelled", cancelled_by: @actor)
        elsif !(@from == "awaiting_payment" && unanswered_hold?)
          partner("booking.guest_cancelled")
        end
      in [ "requested", "expired" ]
        partner("booking.request_expired")
        guest("booking.request_unanswered")
      in [ _, "expired" ]
        guest("booking.hold_expired")
        partner("booking.payment_expired") unless unanswered_hold?
      else nil
      end
    end

    private

    def partner(kind)
      Notify.call(kind, @booking.listing.partner, @booking, params: Copy.booking_params(@booking))
    end

    def guest(kind, **extra)
      Notify.call(kind, @booking.user, @booking, params: Copy.booking_params(@booking, **extra))
    end

    # Held for payment without the partner ever answering: an instant hold, which they aren't
    # told of until it is paid.
    def unanswered_hold?
      @booking.responded_at.nil?
    end

    # A changed booking confirmed again on its first payment is not news to the partner, who
    # just accepted it.
    def first_confirmation?
      @booking.events.where(to_status: "confirmed").count <= 1
    end
  end
end
