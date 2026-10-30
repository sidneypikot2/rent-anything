FactoryBot.define do
  factory :notification do
    recipient factory: :user
    kind { "booking.accepted" }
    subject { association(:booking, :checkout, user: recipient) }
    params { Notifications::Copy.booking_params(subject) }
  end
end
