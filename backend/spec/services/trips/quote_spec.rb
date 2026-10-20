require "rails_helper"

RSpec.describe Trips::Quote do
  let(:trip) { create(:trip) }

  def line(result, item)
    result[:items].find { _1[:trip_item_id] == item.id }
  end

  it "gives a booked item its booking's total" do
    item = create(:trip_item, trip:)
    create(:booking, :checkout, listing: item.listing, trip_item: item, status: "confirmed", total_cents: 123_400,
      starts_on: item.starts_on, ends_on: item.ends_on)

    result = described_class.call(trip)

    expect(line(result, item)).to include(total_cents: 123_400, problem: nil)
    expect(result[:total_cents]).to eq(123_400)
  end

  it "counts a rental as to be agreed, at ₱0" do
    item = create(:trip_item, trip:)

    result = described_class.call(trip)

    expect(line(result, item)).to include(total_cents: 0, to_be_agreed: true, problem: nil)
    expect(result).to include(total_cents: 0, to_be_agreed_count: 1)
  end

  it "flags a listing that can't be booked, and dates that have passed" do
    paused = create(:trip_item, trip:)
    paused.listing.update_columns(status: "paused")
    past = create(:trip_item, trip:)
    trip.update_columns(starts_on: 2.days.ago.to_date)
    past.update_columns(starts_on: 2.days.ago.to_date, ends_on: 2.days.ago.to_date)

    result = described_class.call(trip)

    expect(line(result, paused)).to include(total_cents: nil, problem: "Isn't available to book any more")
    expect(line(result, past)).to include(total_cents: nil, problem: "Its dates have passed")
  end

  it "flags a fully booked day" do
    item = create(:trip_item, trip:)
    create(:booking, listing: item.listing, starts_on: item.starts_on, ends_on: item.ends_on)

    expect(line(described_class.call(trip), item)[:problem]).to eq("#{item.starts_on.strftime('%b %-d')} is fully booked")
  end
end
