require "rails_helper"

RSpec.describe Trips::Copy do
  let(:user) { create(:user) }
  let(:day) { 20.days.from_now.to_date }

  it "copies an undated trip's items undated, without a start date" do
    trip = create(:trip, :undated, user:, name: "Someday")
    create(:trip_item, trip:, starts_on: nil, ends_on: nil, quantity: 3)

    copy = described_class.call(trip, {})[:trip]

    expect(copy).to have_attributes(name: "Someday again", starts_on: nil, ends_on: nil, guests: trip.guests)
    expect(copy.items.map { [ _1.starts_on, _1.quantity ] }).to eq([ [ nil, 3 ] ])
  end

  it "books nothing: a booked item comes over as a plain one" do
    trip = create(:trip, user:)
    item = create(:trip_item, trip:)
    create(:booking, :checkout, listing: item.listing, user:, trip_item: item, status: "confirmed",
      starts_on: item.starts_on, ends_on: item.ends_on)

    copy = described_class.call(trip, { starts_on: day.iso8601, name: "Again", guests: 4 })[:trip]

    expect(copy).to have_attributes(name: "Again", guests: 4, starts_on: day, ends_on: day + 3)
    expect(copy.items.sole).to have_attributes(starts_on: day, booking: nil)
    expect(copy.booked?).to be(false)
  end

  it "keeps a long name within 80 characters" do
    trip = create(:trip, :undated, user:, name: "x" * 80)

    expect(described_class.call(trip, {})[:trip].name.length).to eq(80)
  end

  it "refuses guests that aren't a whole number" do
    trip = create(:trip, :undated, user:)

    expect { described_class.call(trip, { guests: "2" }) }
      .to raise_error(ActiveRecord::RecordInvalid, /Guests must be a whole number/)
  end
end
