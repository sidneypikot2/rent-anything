module Bookings
  # Cancels a booking that hasn't started (RAA-132), by its guest or its partner, with an
  # optional reason, and records what the guest gets back:
  #
  # - nothing was paid yet (a request, an unpaid hold): 0;
  # - the partner cancels: everything, as on Airbnb and Booking.com;
  # - the guest cancels: what the policy the booking was made under says (Listing::
  #   CANCELLATION_POLICIES): free_cancellation refunds in full before the start,
  #   seven_days / fourteen_days in full at least that long before it, non_refundable nothing.
  # - an offline booking was paid outside the app, so no refund is recorded.
  #
  # Cancelling frees its days. The refund is only recorded until payments are real (PayMongo refunds aren't built).
  class Cancel < ApplicationService
    FREE_UNTIL = { "free_cancellation" => 0, "seven_days" => 7, "fourteen_days" => 14 }.freeze

    def self.refund_cents(booking, by:, at: Time.current)
      return nil if booking.source_offline?
      return 0 unless booking.payment
      return booking.total_cents if by == "partner"

      # By the (UTC) date, as the booking's dates are.
      last_free_day = free_until(booking)
      last_free_day && at.utc.to_date <= last_free_day ? booking.total_cents : 0
    end

    # The last day a guest can cancel for a full refund, by the policy the booking was made under
    # (RAA-135): the day before it starts for free_cancellation, the day 7 / 14 days before it for
    # seven_days / fourteen_days. Nil when the policy refunds nothing, or for an offline booking.
    def self.free_until(booking)
      return nil if booking.source_offline?

      days = FREE_UNTIL[booking.cancellation_policy]
      days && booking.starts_on - [ days, 1 ].max
    end

    def initialize(booking, by:, user:, reason: nil)
      @booking = booking
      @by = by
      @user = user
      @reason = reason
    end

    def call
      reason = read_reason
      Booking.transaction do
        @booking.lock!
        Transition.call(@booking, "cancelled", actor: @by, user: @user, reason:,
          attributes: { cancelled_by: @by, cancellation_reason: reason, refund_cents: self.class.refund_cents(@booking, by: @by) })
      end
    end

    private

    def read_reason
      return nil if @reason.nil?
      return @reason.strip.presence if @reason.is_a?(String) && @reason.length <= Booking::REASON_LENGTH

      @booking.errors.add(:base, "Reason must be text of at most #{Booking::REASON_LENGTH} characters")
      raise ActiveRecord::RecordInvalid, @booking
    end
  end
end
