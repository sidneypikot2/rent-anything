require "rails_helper"

RSpec.describe Booking do
  describe "a vehicle rental's days and period (RAA-195)" do
    let(:bike) { create(:listing, :vehicle) }
    let(:on) { 10.days.from_now.to_date }

    it "takes the days it starts on, a single date one" do
      expect(described_class.days_for(bike, on, on + 2).to_a).to eq([ on, on + 1 ])
      expect(described_class.days_for(bike, on, on).to_a).to eq([ on ])
    end

    it "runs 24 hours a day from its pickup time, in the area's time" do
      period = described_class.rental_period(on, on + 2, "14:00")

      expect(period.begin.in_time_zone("Asia/Manila").strftime("%F %H:%M")).to eq("#{on.iso8601} 14:00")
      expect(period.end - period.begin).to eq(48.hours)
    end

    it "is given the default pickup when nothing set one, and is under way until its return day" do
      booking = create(:booking, listing: bike, starts_on: on, ends_on: on + 1)

      expect(booking).to have_attributes(pickup_time: "09:00", last_day: on + 1)
      expect(booking.ends_at - booking.starts_at).to eq(24.hours)
    end
  end

  describe ".units_for" do
    it "takes as many of a piece of gear as the trip item's count" do
      expect(described_class.units_for(create(:listing, :gear), 2)).to eq(2)
    end

    it "takes enough of a vehicle's seats for the guests, rounded up (RAA-191)" do
      expect(described_class.units_for(create(:listing, :vehicle), 10)).to eq(5)
      expect(described_class.units_for(create(:listing, :vehicle), 3)).to eq(2)
    end

    it "takes the more vehicles the guest chose, up to one each" do
      listing = create(:listing, :vehicle)
      expect(described_class.units_for(listing, 10, chosen: 6)).to eq(6)
      expect(described_class.units_for(listing, 10, chosen: 4)).to eq(5)
      expect(described_class.units_for(listing, 3, chosen: 9)).to eq(3)
    end

    it "takes one of a vehicle that doesn't say its seats" do
      listing = create(:listing, :vehicle)
      listing.update_column(:attrs, listing.attrs.except("seats"))
      expect(described_class.units_for(listing.reload, 3)).to eq(1)
    end
  end
end
