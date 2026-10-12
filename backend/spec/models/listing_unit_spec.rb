require "rails_helper"

RSpec.describe ListingUnit do
  let(:listing) { create(:listing) }

  it "numbers a listing's units once each" do
    expect(listing.units.build(position: 1)).not_to be_valid
    expect(listing.units.build(position: 2)).to be_valid
  end

  it "goes with its listing" do
    listing.units.create!(position: 2)
    expect { listing.destroy! }.to change(described_class, :count).by(-2)
  end
end
