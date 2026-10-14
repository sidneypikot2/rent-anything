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

    # A property type under Accommodation (RAA-82), priced by a stay rate (RAA-104).
    trait :accommodation do
      name { "Guesthouse" }
      booking_type { "stay" }
      parent do
        Category.find_by(slug: "accommodation") ||
          association(:category, :parent, slug: "accommodation", name: "Accommodation")
      end
    end

    # The Tour category (RAA-110), whose listings have tour details. There is only one.
    trait :tour do
      slug { "tour" }
      name { "Tour" }
      booking_type { "activity" }
      attribute_schema do
        { type: "object", properties: { guide_included: { type: "boolean" }, life_vests: { type: "boolean" } },
          required: %w[guide_included] }
      end
      initialize_with { Category.find_or_initialize_by(slug: "tour") }
    end
  end

  factory :listing do
    area
    category
    partner factory: %i[user partner]
    # The partner's first business (RAA-100), or a new one.
    business { partner.businesses.first || association(:business, partner:) }
    title { "GoPro Hero 12" }
    location { "POINT(123.368 9.933)" }
    street { "Panagsama Beach" }
    city { "Moalboal" }
    province { "Cebu" }
    region { "Central Visayas" }
    postal_code { "6032" }
    status { "active" }

    # Every listing has at least one unit (RAA-98); Listings::Create makes them in the app.
    after(:create) { |listing| listing.units.create!(position: 1) if listing.units.none? }

    trait :pending do
      status { "pending" }
    end

    # An entire place sleeping 4, at ₱2,000 a night for up to 2 guests (RAA-104).
    trait :stay do
      category factory: %i[category accommodation]
      title { "Kota Beach house" }
      attrs { { "place_type" => "entire_place", "guests" => 4 } }
      transient { with_rate { true } }
      after(:create) { |listing, context| create(:stay_rate, listing:) if context.with_rate && !listing.stay_rate }
    end

    # A daily joiner tour for 2 to 12 guests, 4 hours, at ₱1,500 a head (RAA-110).
    trait :tour do
      category factory: %i[category tour]
      title { "Virgin Island hopping" }
      attrs { { "guide_included" => true } }
      transient { with_detail { true } }
      after(:create) { |listing, context| create(:tour_detail, listing:) if context.with_detail && !listing.tour_detail }
    end
  end

  factory :tour_detail do
    listing { association(:listing, :tour, with_detail: false) }
    tour_type { "joiner" }
    min_guests { 2 }
    max_guests { 12 }
    max_groups_per_day { 1 }
    duration_value { 4 }
    duration_unit { "hours" }
    weekdays { (0..6).to_a }
    base_price_cents { 150_000 }
  end

  factory :stay_rate do
    listing { association(:listing, :stay, with_rate: false) }
    nightly_price_cents { 200_000 }
    base_guests { 2 }
  end

  factory :listing_fee do
    listing
    sequence(:name) { |n| "Fee #{n}" }
    amount_cents { 50_000 }
    charged_per { "booking" }
    sequence(:position)
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
