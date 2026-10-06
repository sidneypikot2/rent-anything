FactoryBot.define do
  factory :guest_profile do
    user
    legal_first_name { "Ana" }
    legal_last_name { "Reyes" }
    street { "12 Rizal St, Poblacion" }
    city { "City of Makati" }
    region { "National Capital Region" }
    province { nil }
    postal_code { "1200" }
    country { "PH" }
  end
end
