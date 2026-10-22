require "rails_helper"

RSpec.describe TripSerializer do
  let(:day) { 20.days.from_now.to_date }
  let(:trip) { create(:trip, starts_on: day, ends_on: day + 3, guests: 6) }
  # Sleeps 2: six guests would take three of it, and it has one.
  let(:cottage) { create(:listing, :stay, title: "Beachfront bamboo cottage", attrs: { "place_type" => "entire_place", "guests" => 2 }) }

  def unavailable
    described_class.call(Trip.with_items.find(trip.id))[:items].sole[:unavailable]
  end

  before { create(:trip_item, trip:, listing: cottage, starts_on: day, ends_on: day + 3, quantity: 6) }

  it "says nothing while the listing has a unit left, even for more guests than it holds" do
    expect(unavailable).to be_nil
  end

  it "says when a day is fully booked" do
    create(:booking, listing: cottage, starts_on: day + 1, ends_on: day + 2)

    expect(unavailable).to eq("#{(day + 1).strftime('%b %-d')} is fully booked")
  end

  it "says when the partner blocked a day" do
    create(:availability_block, listing: cottage, starts_on: day + 2, ends_on: day + 2)

    expect(unavailable).to eq("#{(day + 2).strftime('%b %-d')} is blocked")
  end
end
