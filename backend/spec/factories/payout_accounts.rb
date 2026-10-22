FactoryBot.define do
  factory :payout_account do
    partner factory: %i[user partner]
    kind { "bank" }
    bank_code { "PH_BDO" }
    account_name { "Juan Dela Cruz" }
    sequence(:account_number) { |n| format("00123456%04d", n) }

    trait :gcash do
      kind { "gcash" }
      bank_code { nil }
      sequence(:account_number) { |n| format("0917%07d", n) }
    end
  end
end
