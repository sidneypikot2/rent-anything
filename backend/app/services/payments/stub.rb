module Payments
  # Pays for some of a checkout's bookings (RAA-132) the moment it is asked: a paid Payment for
  # their total, and each booking held for payment moves to confirmed. It stands in for
  # Xendit's split payment (SPEC.md, Payments) until that is built, which will confirm them from
  # its webhook instead. Bookings no longer held for payment (expired, cancelled meanwhile) are
  # left alone. Returns the payment, or nil when there was nothing to pay for.
  class Stub < ApplicationService
    def initialize(checkout, bookings)
      @checkout = checkout
      @bookings = bookings
    end

    def call
      Booking.transaction do
        held = @bookings.sort_by(&:id).each(&:lock!).select(&:awaiting_payment?)
        next nil if held.empty?

        payment = @checkout.payments.create!(provider: "stub", status: "paid", amount_cents: held.sum(&:total_cents),
          provider_ref: "stub_#{SecureRandom.hex(8)}", paid_at: Time.current)
        held.each do |booking|
          Bookings::Transition.call(booking, "confirmed", actor: "system", attributes: { payment: },
            metadata: { payment_id: payment.id })
        end
        payment
      end
    end
  end
end
