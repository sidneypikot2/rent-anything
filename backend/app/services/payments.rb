# Payments (RAA-143): what guests pay for their bookings, on PayMongo's hosted checkout.
module Payments
  # Whether payments go through PayMongo (PAYMONGO_SECRET_KEY set, a test key only for now) or
  # the stub that pays at once (the local stack, specs and the smoke test, which set no key).
  def self.paymongo?
    Paymongo.configured?
  end
end
