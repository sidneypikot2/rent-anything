FactoryBot.define do
  factory :partner_profile do
    user factory: %i[user partner]
    legal_first_name { "Jun" }
    legal_last_name { "Dela Cruz" }
    street { "Poblacion East" }
    city { "Moalboal" }
    region { "Central Visayas" }
    province { "Cebu" }
    postal_code { "6032" }
    country { "PH" }
  end
end
