require "rails_helper"

RSpec.describe Stays::Arrangement do
  # Three rooms that each sleep 5.
  let(:listing) { create(:listing, :stay, attrs: { "place_type" => "entire_place", "guests" => 5 }) }

  before { (2..3).each { listing.units.create!(position: _1) } }

  def arrange(**party)
    described_class.call(listing.reload, **party)
  end

  def errors_for(**party)
    described_class.new(listing.reload, **party).errors
  end

  it "takes the fewest rooms that sleep the party, spread evenly with an adult in each" do
    expect(arrange(adults: 10)).to eq([ { adults: 5, children: 0, infants: 0 } ] * 2)
    expect(arrange(adults: 3, children: 3)).to eq([
      { adults: 2, children: 1, infants: 0 }, { adults: 1, children: 2, infants: 0 }
    ])
    expect(arrange(adults: 4)).to eq([ { adults: 4, children: 0, infants: 0 } ])
  end

  it "keeps the guest's own split" do
    expect(arrange(adults: 6, room_guests: [ { "adults" => 1 }, { "adults" => 5 } ])).to eq([
      { adults: 1, children: 0, infants: 0 }, { adults: 5, children: 0, infants: 0 }
    ])
  end

  it "puts infants in a bed only when the place counts them" do
    expect(arrange(adults: 5, infants: 1)).to eq([ { adults: 5, children: 0, infants: 1 } ])

    listing.update!(attrs: listing.attrs.merge("infants_count" => true))
    expect(arrange(adults: 5, infants: 1).size).to eq(2)
    expect(errors_for(adults: 5, infants: 1, room_guests: [ { adults: 5, infants: 1 } ])).to eq([
      "A room here sleeps at most 5 guests"
    ])
  end

  it "leaves children out of the beds when the place says so" do
    listing.update!(attrs: listing.attrs.merge("children_count" => false))

    expect(arrange(adults: 5, children: 2)).to eq([ { adults: 5, children: 2, infants: 0 } ])
  end

  it "refuses a room without an adult, rooms that don't add up to the party, and a room over its beds" do
    expect(errors_for(adults: 2, children: 1, room_guests: [ { adults: 2 }, { children: 1 } ])).to eq([
      "Each room needs an adult"
    ])
    expect(errors_for(adults: 3, room_guests: [ { adults: 1 }, { adults: 1 } ])).to eq([
      "The rooms must add up to the party"
    ])
    expect(errors_for(adults: 6, room_guests: [ { adults: 6 } ])).to eq([ "A room here sleeps at most 5 guests" ])
  end

  it "refuses more guests than its rooms sleep, more rooms than it has, and too few adults for the rooms" do
    expect(errors_for(adults: 16)).to eq([ "This place sleeps at most 15 guests in 3 rooms" ])
    expect(errors_for(adults: 4, room_guests: [ { adults: 1 } ] * 4)).to eq([ "This place has 3 rooms" ])
    expect(errors_for(adults: 1, children: 9)).to eq([ "Each room needs an adult: 2 rooms for 1" ])
    expect(errors_for(adults: 0, children: 1)).to eq([ "A stay needs an adult" ])
  end

  it "takes pets only where they are allowed, up to the most it allows" do
    expect(errors_for(adults: 2, pets: 1)).to eq([ "This place doesn't allow pets" ])

    listing.update!(attrs: listing.attrs.merge("pets_allowed" => true, "max_pets" => 2))
    expect(arrange(adults: 2, pets: 2).size).to eq(1)
    expect(errors_for(adults: 2, pets: 3)).to eq([ "This place allows at most 2 pets" ])
  end

  it "books a shared room by the bed, never split into rooms" do
    listing.update!(attrs: { "place_type" => "shared_room", "guests" => 3 })
    listing.stay_rate.update!(base_guests: 1)

    expect(arrange(adults: 3)).to eq([ { adults: 3, children: 0, infants: 0 } ])
    expect(errors_for(adults: 4)).to eq([ "This place sleeps at most 3 guests" ])
    expect(errors_for(adults: 2, room_guests: [ { adults: 2 } ])).to eq([
      "A shared room is booked by the bed, not by the room"
    ])
  end
end
