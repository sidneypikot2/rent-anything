# A guest's payment (the `payment` schema in spec/swagger_helper.rb): what it came to, how it
# stands, and PayMongo's page to pay it on while it is pending.
module PaymentSerializer
  def self.call(payment)
    {
      id: payment.id,
      status: payment.status,
      amount_cents: payment.amount_cents,
      checkout_url: payment.pending? ? payment.checkout_url : nil,
      test_mode: !payment.livemode,
      paid_at: payment.paid_at
    }
  end
end
