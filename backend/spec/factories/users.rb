FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    name { "Ana Reyes" }
    password { "password123" }
    role { "guest" }
    # Has proved it owns its email (RAA-214), so may check out and pay.
    email_confirmed_at { Time.current }

    trait :partner do
      role { "partner" }
    end

    # A partner who has passed the Didit ID check (RAA-44), so may add listings.
    trait :id_verified do
      after(:create) { |user| create(:partner_verification, :approved, user:) }
    end

    # A partner with a business (RAA-100), whose name travellers see, so may add listings.
    trait :business do
      after(:create) { |user| create(:business, partner: user, name: "Moalboal Gear Rentals") }
    end

    trait :admin do
      role { "admin" }
    end

    # Has been through the complete-profile page.
    trait :profile_complete do
      phone { "+639171234567" }
      registration_complete { true }
    end

    # Hasn't confirmed its email yet (RAA-214): a password account can't check out or pay.
    trait :unconfirmed do
      email_confirmed_at { nil }
    end

    # Made with Google or Facebook: no password.
    trait :oauth_only do
      password { nil }
    end
  end
end
