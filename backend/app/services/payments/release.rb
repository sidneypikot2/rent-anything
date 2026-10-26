module Payments
  # Lets a pending PayMongo checkout go, so it can't be paid any more: before its bookings
  # expire (Bookings::Expire), or when the guest pays for some of them with others
  # (Payments::StartCheckout). PayMongo refuses to expire a session already paid (400), so the
  # outcome is always read back (Payments::Sync): paid meanwhile, its bookings are confirmed
  # instead. It also refuses while a payment is going through: then the payment stays pending
  # and the caller leaves its bookings alone. Returns the payment.
  class Release < ApplicationService
    def initialize(payment)
      @payment = payment
    end

    def call
      if @payment.provider_ref
        begin
          Paymongo.expire_checkout_session(@payment.provider_ref)
        rescue Paymongo::Error => e
          raise unless e.status == 400

          return Sync.call(@payment)
        end
        Sync.call(@payment)
      end
      # Expired, or no session was made (PayMongo failed when it was opened).
      @payment.with_lock { @payment.update!(status: "failed", failed_at: Time.current) if @payment.pending? }
      @payment
    end
  end
end
