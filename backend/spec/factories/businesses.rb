FactoryBot.define do
  factory :business do
    partner factory: %i[user partner]
    sequence(:name) { |n| "Moalboal Business #{n}" }
    street { "Panagsama Beach" }
    city { "Moalboal" }
    province { "Cebu" }
    region { "Central Visayas" }
    postal_code { "6032" }
    location { "POINT(123.368 9.933)" }
  end
end
