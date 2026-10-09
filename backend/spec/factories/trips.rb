FactoryBot.define do
  factory :trip do
    user
    name { "Bantayan Island · Nov 12–15" }
    starts_on { 10.days.from_now.to_date }
    ends_on { 13.days.from_now.to_date }

    trait :undated do
      starts_on { nil }
      ends_on { nil }
    end
  end

  factory :trip_item do
    trip
    listing
    starts_on { trip.starts_on }
    ends_on { trip.starts_on }
  end
end
