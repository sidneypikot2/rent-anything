require "rails_helper"

RSpec.describe Booking do
  describe ".units_for" do
    it "takes as many of a piece of gear as the trip item's count" do
      expect(described_class.units_for(create(:listing, :gear), 2)).to eq(2)
    end

    it "takes one vehicle whatever the guests" do
      expect(described_class.units_for(create(:listing, :vehicle), 3)).to eq(1)
    end
  end
end
