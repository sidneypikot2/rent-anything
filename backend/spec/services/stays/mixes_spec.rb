require "rails_helper"

RSpec.describe Stays::Mixes do
  include_context "a business with three room types"

  let(:starts_on) { 20.days.from_now.to_date }
  let(:ends_on) { starts_on + 2 }

  def mixes(adults: 5, children: 1, infants: 1, pets: 1, listings: room_types)
    described_class.call(listings.map(&:reload), starts_on:, ends_on:, adults:, children:, infants:, pets:)
  end

  def summary(mix)
    [ mix[:label], mix[:items].to_h { [ _1[:title], _1[:rooms] ] }, mix[:total_cents] ]
  end

  it "suggests the cheapest mix, the cheapest private one and the cheapest of one room type" do
    expect(mixes.map { summary(_1) }).to eq([
      [ "cheapest", { "Family room" => 1, "Backpacker dorm" => 1 }, 880_000 ],
      [ "private", { "Family room" => 1, "Garden cottage" => 1 }, 1_180_000 ],
      [ "one_type", { "Family room" => 2 }, 1_180_000 ]
    ])
  end

  it "fills each mix's rooms evenly, an adult in each, and puts the pets where they are allowed" do
    cheapest, private, one_type = mixes

    expect(cheapest[:items]).to eq([
      { listing_id: family_room.id, title: "Family room", rooms: 1, quantity: 6, pets: 1, total_cents: 760_000,
        room_guests: [ { adults: 4, children: 1, infants: 1 } ] },
      { listing_id: dorm.id, title: "Backpacker dorm", rooms: 1, quantity: 1, pets: 0, total_cents: 120_000, room_guests: nil }
    ])
    expect(private[:items].map { _1.slice(:title, :room_guests, :pets, :total_cents) }).to eq([
      { title: "Family room", room_guests: [ { adults: 3, children: 1, infants: 1 } ], pets: 1, total_cents: 680_000 },
      { title: "Garden cottage", room_guests: [ { adults: 2, children: 0, infants: 0 } ], pets: 0, total_cents: 500_000 }
    ])
    expect(one_type[:items].first[:room_guests]).to eq([
      { adults: 3, children: 0, infants: 1 }, { adults: 2, children: 1, infants: 0 }
    ])
  end

  it "skips a label whose mix is already shown and fills the rest cheapest first" do
    result = mixes(infants: 0, pets: 0)

    # The dorm alone is both the cheapest and of one room type.
    expect(result.map { summary(_1) }).to eq([
      [ "cheapest", { "Backpacker dorm" => 6 }, 720_000 ],
      [ "private", { "Family room" => 1, "Garden cottage" => 1 }, 1_160_000 ],
      [ "other", { "Family room" => 1, "Backpacker dorm" => 1 }, 860_000 ]
    ])
    expect(result.map { _1[:label] }.uniq.size).to eq(result.size)
  end

  it "puts infants in a private room, never in a shared one" do
    expect(mixes(pets: 0).map { summary(_1) }.first).to eq([ "cheapest", { "Family room" => 1, "Backpacker dorm" => 1 }, 860_000 ])
  end

  it "drops every mix without a room type that takes the pets" do
    expect(mixes(pets: 1)).to all(satisfy { |mix| mix[:items].any? { _1[:listing_id] == family_room.id } })
  end

  it "leaves out rooms that are fully booked" do
    create(:booking, listing: family_room, starts_on:, ends_on: starts_on + 1, quantity: 2)

    expect(mixes.map { summary(_1) }).to eq([
      [ "cheapest", { "Family room" => 1, "Backpacker dorm" => 1 }, 880_000 ],
      [ "private", { "Family room" => 1, "Garden cottage" => 1 }, 1_180_000 ],
      [ "other", { "Family room" => 1, "Backpacker dorm" => 2 }, 920_000 ]
    ])
  end

  it "suggests nothing when no mix sleeps the party" do
    create(:availability_block, listing: family_room, starts_on:, ends_on:)

    expect(mixes).to eq([])
  end
end
