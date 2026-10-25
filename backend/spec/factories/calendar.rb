FactoryBot.define do
  factory :availability_block do
    listing
    starts_on { Date.current + 3 }
    ends_on { starts_on + 1 }
    reason { "Fiesta" }
  end

  factory :listing_day do
    listing
    date { Date.current + 1 }
    price_cents { 250_000 }
  end

  factory :booking do
    listing
    guest_name { "Maria Santos" }
    starts_on { Date.current + 1 }
    ends_on { starts_on + 2 }
    quantity { 1 }
    source { "offline" }
    total_cents { 400_000 }

    # A guest's, from checkout (RAA-132), confirmed and paid unless a status says otherwise.
    trait :checkout do
      source { "checkout" }
      user factory: :user
      checkout { association(:checkout, user:) }
      # Copied from the guest at checkout, as Checkouts::Create does (RAA-175).
      guest_email { user&.email }
      guest_phone { user&.phone }
      guests { 2 }
      booking_mode { listing.booking_mode }
      cancellation_policy { listing.cancellation_policy }
      payment { status.in?(%w[confirmed in_progress completed]) ? association(:payment, checkout:, amount_cents: total_cents) : nil }
    end
  end

  factory :checkout do
    user
    sequence(:idempotency_key) { |n| "checkout-key-#{n}" }
    total_cents { 400_000 }
  end

  factory :payment do
    checkout
    provider { "stub" }
    status { "paid" }
    amount_cents { 400_000 }
    paid_at { Time.current }
  end
end
