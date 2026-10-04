FactoryBot.define do
  factory :user do
    name { "Juan Dela Cruz" }
    sequence(:email) { |n| "user#{n}@example.com" }
    password { "correct horse" }

    trait :partner do
      role { "partner" }
    end

    trait :admin do
      role { "admin" }
    end
  end
end
