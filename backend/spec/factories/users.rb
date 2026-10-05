FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    name { "Ana Reyes" }
    password { "password123" }
    role { "guest" }

    trait :partner do
      role { "partner" }
    end

    trait :admin do
      role { "admin" }
    end

    # Made with Google or Facebook: no password.
    trait :oauth_only do
      password { nil }
    end
  end
end
