require "rails_helper"

RSpec.describe Booking do
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
