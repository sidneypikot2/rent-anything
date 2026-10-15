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
  end
end
