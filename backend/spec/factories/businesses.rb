FactoryBot.define do
  factory :business do
    partner factory: %i[user partner]
    sequence(:name) { |n| "Moalboal Business #{n}" }
  end
end
