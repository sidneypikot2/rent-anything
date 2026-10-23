require "rails_helper"

RSpec.describe Trip do
  describe "#deletes_on" do
    it "is nil for a trip that hasn't ended" do
      expect(build(:trip).deletes_on).to be_nil
      expect(build(:trip, starts_on: Date.current - 1, ends_on: Date.current).deletes_on).to be_nil
    end

    it "is the 8th day after a trip ends, once it has ended" do
      trip = build(:trip, starts_on: Date.current - 3, ends_on: Date.current - 1)
      expect(trip.deletes_on).to eq(Date.current + 7)
    end

    it "is 67 days after the last edit of an undated trip, once it has gone 60 days without one" do
      expect(build(:trip, :undated, updated_at: 59.days.ago).deletes_on).to be_nil

      trip = build(:trip, :undated, updated_at: 60.days.ago)
      expect(trip.deletes_on).to eq(Date.current + 7)
    end
  end

  describe "scopes on the deletion date" do
    def undated(last_edit)
      create(:trip, :undated).tap { |trip| trip.update_columns(updated_at: last_edit) }
    end

    def ended(on)
      create(:trip).tap { |trip| trip.update_columns(starts_on: on - 1, ends_on: on) }
    end

    it "splits trips between the cart and the cleanup on #deletes_on" do
      kept = [ create(:trip), undated(Time.current), undated((Date.current - 66).beginning_of_day),
        ended(Date.current - 7) ]
      due = [ undated((Date.current - 67).end_of_day), ended(Date.current - 8) ]

      expect(described_class.in_cart).to match_array(kept)
      expect(described_class.due_for_cleanup).to match_array(due)
      expect(kept.map(&:deletes_on)).to all(satisfy { |date| date.nil? || date > Date.current })
      expect(due.map(&:deletes_on)).to all(be <= Date.current)
    end

    it "doesn't suggest an undated trip past its deletion date" do
      fresh = undated(66.days.ago)
      undated(68.days.ago)

      expect(described_class.current).to contain_exactly(fresh)
    end
  end

  describe "an auto-named trip's name (RAA-137)" do
    let(:from) { Date.new(Date.current.year + 1, 3, 12) }
    let(:trip) { create(:trip, name: "Bantayan Island · Mar 12–15", starts_on: from, ends_on: from + 3) }

    it "follows the trip's dates" do
      trip.update!(ends_on: from + 5)
      expect(trip.reload.name).to eq("Bantayan Island · Mar 12–17")

      trip.update!(starts_on: from - 13)
      expect(trip.reload.name).to eq("Bantayan Island · Feb 27 – Mar 17")
    end

    it "follows them when an item extends the trip" do
      day = (from + 6).iso8601
      Trips::AddItem.call(trip.user,
        { listing_id: create(:listing).id, trip_id: trip.id, starts_on: day, ends_on: day }.with_indifferent_access)

      expect(trip.reload.name).to eq("Bantayan Island · Mar 12–18")
    end

    it "loses its dates when the trip has none" do
      trip.update!(starts_on: nil, ends_on: nil)
      expect(trip.reload.name).to eq("Bantayan Island")
    end

    it "is kept when the guest typed it, or changed it with the dates" do
      typed = create(:trip, name: "Barkada summer", starts_on: from, ends_on: from + 3)
      typed.update!(ends_on: from + 5)
      expect(typed.reload.name).to eq("Barkada summer")

      trip.update!(name: "Our trip · Mar 12–15", ends_on: from + 5)
      expect(trip.reload.name).to eq("Our trip · Mar 12–15")
    end

    it "stays within 80 characters" do
      place = "A" * 66
      long = create(:trip, name: "#{place} · Mar 12–15", starts_on: from, ends_on: from + 3)
      long.update!(starts_on: from - 13)

      suffix = " · Feb 27 – Mar 15"
      expect(long.reload.name).to eq(place.truncate(80 - suffix.length) + suffix)
    end
  end
end
