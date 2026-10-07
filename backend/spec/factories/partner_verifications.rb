FactoryBot.define do
  factory :partner_verification do
    user factory: %i[user partner]
    sequence(:didit_session_id) { |n| "00000000-0000-4000-8000-#{n.to_s.rjust(12, '0')}" }
    status { "in_progress" }

    trait :approved do
      status { "approved" }
      verified_at { Time.current }
    end
  end
end
