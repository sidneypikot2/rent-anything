module Bookings
  # A partner's answer to a booking request (RAA-132): "accepted" holds it for the guest's
  # payment, which the stub takes at once (Payments::Stub), so it ends confirmed; "declined"
  # frees its days. A request past its answer-by time has expired instead, and saying so is a
  # 422. `actor` is "system" when requests are accepted automatically (Bookings.auto_accept?),
  # until partners have an inbox.
  class Respond < ApplicationService
    DECISIONS = %w[accepted declined].freeze

    def initialize(booking, decision, actor: "partner", user: nil)
      @booking = booking
      @decision = decision
      @actor = actor
      @user = user
    end

    def call
      refuse!("A request can be accepted or declined") unless DECISIONS.include?(@decision)

      expired = Booking.transaction do
        @booking.lock!
        next expire! if @booking.requested? && @booking.expires_at&.past?

        Transition.call(@booking, @decision, actor: @actor, user: @user)
        Transition.call(@booking, "awaiting_payment", actor: "system") if @decision == "accepted"
        false
      end
      refuse!("This request has expired") if expired

      Payments::Stub.call(@booking.checkout, [ @booking ]) if @booking.awaiting_payment?
      @booking.reload
    end

    private

    def expire!
      Transition.call(@booking, "expired", actor: "system", reason: "Not answered in time")
      true
    end

    def refuse!(message)
      @booking.errors.add(:base, message)
      raise ActiveRecord::RecordInvalid, @booking
    end
  end
end
