# The example business of RAA-187: three room types, each its own stay listing.
#
# - Family room: sleeps 5, 3 rooms, ₱2,500 for 2 and ₱400 per extra guest a night; up to 2
#   pets, ₱200 per pet.
# - Garden cottage: sleeps 2, 2 rooms, ₱2,500.
# - Backpacker dorm: a shared room of 6 beds, ₱600 a bed.
RSpec.shared_context "a business with three room types" do
  let(:family_room) do
    create(:listing, :stay, title: "Family room", attrs: {
      "place_type" => "entire_place", "guests" => 5, "pets_allowed" => true, "max_pets" => 2
    }).tap do |listing|
      (2..3).each { listing.units.create!(position: _1) }
      listing.stay_rate.update!(nightly_price_cents: 250_000, base_guests: 2, extra_guest_fee_cents: 40_000)
      create(:listing_fee, listing:, name: "Pet fee", amount_cents: 20_000, charged_per: "pet")
    end
  end
  let(:cottage) do
    create(:listing, :stay, title: "Garden cottage", partner: family_room.partner, business: family_room.business,
      area: family_room.area, attrs: { "place_type" => "entire_place", "guests" => 2 }).tap do |listing|
      listing.units.create!(position: 2)
      listing.stay_rate.update!(nightly_price_cents: 250_000, base_guests: 2)
    end
  end
  let(:dorm) do
    create(:listing, :stay, title: "Backpacker dorm", partner: family_room.partner, business: family_room.business,
      area: family_room.area, attrs: { "place_type" => "shared_room", "guests" => 6 }, with_rate: false).tap do |listing|
      (2..6).each { listing.units.create!(position: _1) }
      create(:stay_rate, listing:, nightly_price_cents: 60_000, base_guests: 1)
    end
  end
  let(:room_types) { [ family_room, cottage, dorm ] }
end
