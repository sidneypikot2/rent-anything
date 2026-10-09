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
end
