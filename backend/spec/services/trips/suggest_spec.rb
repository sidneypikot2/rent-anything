require "rails_helper"

RSpec.describe Trips::Suggest do
  let(:guest) { create(:user) }
  let(:bantayan) { create(:area, kind: "island", name: "Bantayan Island") }
  let(:santa_fe) { create(:area, kind: "town", name: "Santa Fe", parent: bantayan) }
  let(:malapascua) { create(:area, kind: "island", name: "Malapascua", center: "POINT(124.11 11.33)") }
  let(:siargao) { create(:area, kind: "island", name: "Siargao", center: "POINT(126.05 9.85)") }

  let(:santa_fe_tour) { create(:listing, area: santa_fe, location: "POINT(123.80 11.16)") }
  let(:dive) { create(:listing, area: malapascua, location: "POINT(124.11 11.33)") }
  let(:surf) { create(:listing, area: siargao, location: "POINT(126.16 9.81)") }

  let(:day) { 20.days.from_now.to_date }

  def trip_with(listing, from, to, **attributes)
    trip = create(:trip, user: guest, starts_on: from, ends_on: to, **attributes)
    create(:trip_item, trip:, listing:, starts_on: from, ends_on: from)
    trip
  end

  def suggest(listing, from = nil, to = from)
    described_class.call(guest, listing:, starts_on: from, ends_on: to)
  end

  context "with a dated item" do
    it "suggests the trip whose dates it falls in, whatever its area" do
      bantayan_trip = trip_with(santa_fe_tour, day, day + 3)

      result = suggest(dive, day + 3)
      expect(result).to include(trip: bantayan_trip, extends_to: nil)
    end

    it "suggests a trip up to 3 days away and says how far it would extend" do
      bantayan_trip = trip_with(santa_fe_tour, day, day + 3)

      result = suggest(dive, day + 6)
      expect(result[:trip]).to eq(bantayan_trip)
      expect(result[:extends_to]).to eq(starts_on: day, ends_on: day + 6)
    end

    it "proposes a new trip more than 3 days from every trip" do
      trip_with(santa_fe_tour, day, day + 3)

      result = suggest(dive, day + 7)
      expect(result).to include(trip: nil, extends_to: nil, new_trip_name: start_with("Malapascua · "))
    end

    it "prefers the nearest dates over the nearest items" do
      far_but_inside = trip_with(surf, day + 3, day + 5, name: "Siargao")
      trip_with(santa_fe_tour, day + 5, day + 6, name: "Bantayan")

      expect(suggest(dive, day + 4)[:trip]).to eq(far_but_inside)
    end

    it "breaks a tie on dates by the nearest items" do
      trip_with(surf, day + 5, day + 6, name: "Siargao")
      near = trip_with(santa_fe_tour, day + 5, day + 6, name: "Bantayan")

      expect(suggest(dive, day + 4)[:trip]).to eq(near)
    end

    it "ignores undated trips and another guest's trips" do
      create(:trip, :undated, user: guest)
      create(:trip, starts_on: day, ends_on: day + 3)

      expect(suggest(dive, day + 1)[:trip]).to be_nil
    end
  end

  context "with an undated item" do
    it "suggests the most recently edited trip with the same destination" do
      older = trip_with(santa_fe_tour, day, day + 1, name: "Older")
      newer = trip_with(santa_fe_tour, day + 30, day + 31, name: "Newer")
      older.touch
      trip_with(dive, day, day + 1, name: "Malapascua")

      expect(suggest(create(:listing, area: santa_fe))).to include(trip: older, extends_to: nil)
      expect(newer).to be_persisted
    end

    it "proposes a new trip named after the destination alone" do
      trip_with(dive, day, day + 1)

      expect(suggest(santa_fe_tour)).to include(trip: nil, new_trip_name: "Bantayan Island")
    end
  end

  it "ignores trips that have ended" do
    ended = create(:trip, user: guest, starts_on: day, ends_on: day + 1)
    ended.update_columns(starts_on: 5.days.ago.to_date, ends_on: 2.days.ago.to_date)

    expect(suggest(dive, Date.current)[:trip]).to be_nil
  end
end
