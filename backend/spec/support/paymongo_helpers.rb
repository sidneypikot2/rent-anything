# PayMongo in specs (Paymongo, Payments::*): off unless a spec turns it on with a test key, its
# API stubbed. Off whatever the machine has set: a worktree copies the main checkout's env files.
module PaymongoHelpers
  def disable_paymongo
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("PAYMONGO_SECRET_KEY").and_return(nil)
    allow(ENV).to receive(:[]).with("PAYMONGO_WEBHOOK_SECRET").and_return(nil)
  end

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

RSpec.configure do |config|
  config.include PaymongoHelpers
  config.before { disable_paymongo }
end
