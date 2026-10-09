require "rails_helper"

RSpec.describe Trips::Cleanup do
  def ended(days_ago)
    trip = create(:trip)
    item = create(:trip_item, trip:)
    trip.update_columns(starts_on: (days_ago + 2).days.ago.to_date, ends_on: days_ago.days.ago.to_date)
    item.update_columns(starts_on: trip.starts_on, ends_on: trip.starts_on)
    trip
  end

  def idle(days)
    trip = create(:trip, :undated)
    create(:trip_item, trip:, starts_on: nil, ends_on: nil)
    trip.update_columns(updated_at: days.days.ago)
    trip
  end

  it "deletes trips that ended more than 7 days ago, with their items" do
    gone = ended(8)
    kept = [ ended(7), ended(1), create(:trip) ]

    described_class.call

    expect(Trip.exists?(gone.id)).to be(false)
    expect(TripItem.where(trip_id: gone.id)).to be_empty
    expect(Trip.all).to match_array(kept)
  end

  it "deletes undated trips with no edits for more than 67 days" do
    idle(68)
    kept = idle(66)

    described_class.call

    expect(Trip.all).to contain_exactly(kept)
  end

  it "returns how many trips it deleted" do
    ended(9)
    idle(70)

    expect(described_class.call).to eq(2)
  end

  it "skips a trip edited or deleted after it was found" do
    edited = idle(70)
    deleted = idle(70)
    allow(Trip).to receive(:due_for_cleanup).and_wrap_original do |original|
      original.call.tap do
        edited.touch
        deleted.destroy!
      end
    end

    expect(described_class.call).to eq(0)
    expect(Trip.all).to contain_exactly(edited)
  end
end
