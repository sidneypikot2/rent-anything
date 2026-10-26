module Payments
  # Records what became of a PayMongo payment, read back from its checkout session: the only
  # place one is marked paid or failed. Called by the webhook, when the guest returns to the
  # cart, and before a checkout is let go (Payments::Release). Safe to call again: a payment
  # no longer pending is left alone, so a repeated webhook changes nothing.
  #
  # Paid, each booking it covers that is still held for payment is confirmed on it. One let go
  # meanwhile (expired, cancelled) can't be: when none could, the payment needs a refund, which
  # is reported (refunds aren't made in the app yet). An expired session fails the payment; an
  # active one, still being paid, changes nothing. Returns the payment.
  class Sync < ApplicationService
    def initialize(payment)
      @payment = payment
    end

    def call
      return @payment unless @payment.pending? && @payment.provider == "paymongo" && @payment.provider_ref

      attributes = Paymongo.checkout_session(@payment.provider_ref)["attributes"] || {}
      paid = Array(attributes["payments"]).find { _1.dig("attributes", "status") == "paid" }
      Payment.transaction do
        @payment.lock!
        next unless @payment.pending?

        if paid
          record_paid(paid)
        elsif attributes["status"] == "expired"
          @payment.update!(status: "failed", failed_at: Time.current)
        end
      end
      @payment
    end

    private

    def record_paid(paid)
      bookings = Booking.where(id: @payment.covered_booking_ids).order(:id).lock.to_a
      held, missed = bookings.partition { _1.awaiting_payment? && _1.payment_id.nil? }
      @payment.update!(status: held.any? ? "paid" : "needs_refund", paid_at: Time.current, provider_payment_id: paid["id"])
      held.each do |booking|
        Bookings::Transition.call(booking, "confirmed", actor: "system", attributes: { payment: @payment },
          metadata: { payment_id: @payment.id })
      end
      return if missed.empty?

      Sentry.capture_message("PayMongo payment #{@payment.id} came in for bookings no longer held: #{missed.map(&:id).join(', ')}",
        level: :error)
    end
  end
end
