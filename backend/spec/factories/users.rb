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

    # Has been through the complete-profile page.
    trait :profile_complete do
      phone { "+639171234567" }
      registration_complete { true }
    end

    # Made with Google or Facebook: no password.
    trait :oauth_only do
      password { nil }
    end
  end
end
