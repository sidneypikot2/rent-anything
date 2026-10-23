require "rails_helper"

RSpec.describe Trips::Save do
  let(:day) { 20.days.from_now.to_date }
  let(:trip) { create(:trip, starts_on: day, ends_on: day + 3, guests: 4) }
  let(:van) { create(:listing, title: "Van rental") }
  let(:tour) { create(:listing, title: "Island hopping") }

  describe "new dates" do
    it "takes the items that spanned the whole trip along, and leaves the rest on their days" do
      whole = create(:trip_item, trip:, listing: van, starts_on: day, ends_on: day + 3)
      one_day = create(:trip_item, trip:, listing: tour, starts_on: day + 2, ends_on: day + 2)

      described_class.call(trip, { starts_on: (day - 1).iso8601, ends_on: (day + 3).iso8601 })

      expect(trip.reload).to have_attributes(starts_on: day - 1, ends_on: day + 3)
      expect(whole.reload).to have_attributes(starts_on: day - 1, ends_on: day + 3)
      expect(one_day.reload).to have_attributes(starts_on: day + 2, ends_on: day + 2)
    end

    it "leaves an item the new dates no longer reach undated, rather than refusing them" do
      outside = create(:trip_item, trip:, listing: tour, starts_on: day + 3, ends_on: day + 3)

      described_class.call(trip, { starts_on: day.iso8601, ends_on: (day + 1).iso8601 })

      expect(trip.reload.ends_on).to eq(day + 1)
      expect(outside.reload).to have_attributes(starts_on: nil, ends_on: nil)
    end

    it "keeps a booked item as it is, so dates leaving it outside are refused" do
      booked = create(:trip_item, trip:, listing: van, starts_on: day, ends_on: day + 3)
      create(:booking, :checkout, listing: van, trip_item: booked, starts_on: day, ends_on: day + 3, status: "confirmed")

      expect { described_class.call(trip, { starts_on: (day + 1).iso8601, ends_on: (day + 4).iso8601 }) }
        .to raise_error(ActiveRecord::RecordInvalid, /must cover the dates of its items/)
      expect(booked.reload).to have_attributes(starts_on: day, ends_on: day + 3)
    end
  end

  describe "new guests" do
    it "changes the items that were for the whole group, not the ones for part of it" do
      group = create(:trip_item, trip:, listing: van, quantity: 4)
      part = create(:trip_item, trip:, listing: tour, quantity: 2)

      described_class.call(trip, { guests: 6 })

      expect(group.reload.quantity).to eq(6)
      expect(part.reload.quantity).to eq(2)
    end
  end
end
