module Payments
  # Opens a PayMongo checkout for some of a guest's bookings held for payment (Payments::Pay):
  # a pending payment for their total, one line item each, and PayMongo's hosted page to pay it
  # on, which returns the guest to the cart (?payment=<id>). Asked again for the same bookings
  # (a retry, a double tap), it returns the checkout already open. A checkout open for some of
  # them with others is let go first (Payments::Release), so a booking is in one at a time.
  #
  # Each booking is held at least Payment::CHECKOUT_WINDOW from now, so its hold can't run out
  # while the guest is on PayMongo's page; Bookings::Expire lets the checkout go before it
  # expires a booking. Returns the payment.
  class StartCheckout < ApplicationService
    METHODS = %w[gcash paymaya card qrph].freeze

    def initialize(user, bookings)
      @user = user
      @bookings = bookings.sort_by(&:id)
      @ids = @bookings.map(&:id)
    end

    def call
      open = Payment.open_checkouts.covering(@ids).to_a
      same = open.find { _1.covered_booking_ids.sort == @ids && _1.checkout_url }
      return hold(same) if same

      open.each { Release.call(_1) }
      refuse!("A payment for some of these is still going through") if open.any?(&:pending?)
      refuse!("Some of these were paid for meanwhile") unless Booking.where(id: @ids).all?(&:awaiting_payment?)
      total = @bookings.sum(&:total_cents)
      refuse!("A payment must come to at least #{format_peso(Payment::MINIMUM_CENTS)}") if total < Payment::MINIMUM_CENTS

      checkouts = @bookings.map(&:checkout).uniq
      payment = Payment.create!(user: @user, checkout: checkouts.one? ? checkouts.first : nil, provider: "paymongo",
        status: "pending", amount_cents: total, covered_booking_ids: @ids)
      open_session(payment)
      hold(payment)
    end

    private

    def open_session(payment)
      session = Paymongo.create_checkout_session(
        line_items: @bookings.map { line_item(_1) },
        payment_method_types: METHODS,
        description: "Rent-Anything booking #{@bookings.map(&:reference).join(', ')}".first(255),
        reference_number: "payment-#{payment.id}",
        metadata: { payment_id: payment.id.to_s },
        success_url: return_url(payment),
        cancel_url: return_url(payment),
        send_email_receipt: true
      )
      url = session.dig("attributes", "checkout_url")
      raise Paymongo::Error, "PayMongo returned no checkout" unless session["id"].is_a?(String) && url.is_a?(String)

      payment.update!(provider_ref: session["id"], checkout_url: url)
    rescue Paymongo::Error
      payment.update!(status: "failed", failed_at: Time.current)
      raise
    end

    def line_item(booking)
      dates = [ booking.starts_on, booking.ends_on ].uniq.map { _1.strftime("%b %-d, %Y") }.join(" – ")
      { name: booking.listing.title.first(255), quantity: 1, amount: booking.total_cents, currency: "PHP",
        description: "#{booking.reference} · #{dates}" }
    end

    def hold(payment)
      Booking.where(id: payment.covered_booking_ids, status: "awaiting_payment").where(expires_at: ...Payment::CHECKOUT_WINDOW.from_now)
        .update_all(expires_at: Payment::CHECKOUT_WINDOW.from_now)
      payment
    end

    def return_url(payment)
      "#{ENV.fetch('FRONTEND_ORIGIN', 'http://localhost:8100')}/cart?payment=#{payment.id}"
    end

    def format_peso(cents)
      "₱#{cents / 100}"
    end

    def refuse!(message)
      booking = Booking.new
      booking.errors.add(:base, message)
      raise ActiveRecord::RecordInvalid, booking
    end
  end
end
