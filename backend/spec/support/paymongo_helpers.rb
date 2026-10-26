# PayMongo in specs (Paymongo, Payments::*): turned on with a test key, its API stubbed.
module PaymongoHelpers
  def enable_paymongo
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("PAYMONGO_SECRET_KEY").and_return("sk_test_spec")
    allow(ENV).to receive(:[]).with("PAYMONGO_WEBHOOK_SECRET").and_return("whsk_test_spec")
  end

  # A checkout session as PayMongo answers it; a paid one has a paid payment.
  def paymongo_session(id, status: "active", paid: false)
    payments = paid ? [ { "id" => "pay_#{id}", "attributes" => { "status" => "paid" } } ] : []
    { "id" => id, "attributes" => { "status" => status, "checkout_url" => "https://checkout.paymongo.com/#{id}",
                                    "payments" => payments } }
  end
end

RSpec.configure { |config| config.include PaymongoHelpers }
