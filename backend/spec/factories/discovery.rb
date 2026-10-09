FactoryBot.define do
  factory :area do
    sequence(:slug) { |n| "area-#{n}" }
    name { "Moalboal" }
    kind { "town" }
    center { "POINT(123.396 9.945)" }
    status { "published" }

    trait :draft do
      status { "draft" }
    end
  end

  factory :landmark do
    area
    sequence(:slug) { |n| "landmark-#{n}" }
    name { "Pescador Island" }
    location { "POINT(123.344 9.926)" }
    status { "published" }

    trait :draft do
      status { "draft" }
    end
  end

  factory :tag do
    sequence(:slug) { |n| "tag-#{n}" }
    name { "Snorkelling" }
    kind { "activity" }
  end

  factory :category do
    sequence(:slug) { |n| "category-#{n}" }
    name { "Action camera" }
    booking_type { "rental" }

    trait :parent do
      booking_type { nil }
    end
  end

  factory :listing do
    area
    category
    partner factory: %i[user partner]
    title { "GoPro Hero 12" }
    location { "POINT(123.368 9.933)" }
    street { "Panagsama Beach" }
    city { "Moalboal" }
    province { "Cebu" }
    region { "Central Visayas" }
    postal_code { "6032" }
    status { "active" }

    trait :pending do
      status { "pending" }
    end
  end

  factory :destination_link do
    source factory: :area
    target factory: :landmark
    kind { "bundled" }
  end

  factory :search_event do
    query_normalized { "moalboal" }
    result_count { 1 }
    sequence(:session_hash) { |n| format("%064x", n) }
    target { nil }
  end
end
