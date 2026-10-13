require "rails_helper"

RSpec.describe ListingFee do
  let(:listing) { create(:listing) }

  it "names a listing's fees once each, ignoring case, charged per one of the known things" do
    create(:listing_fee, listing:, name: "Cleaning fee", position: 1)

    expect(build(:listing_fee, listing:, name: "cleaning fee")).not_to be_valid
    expect(build(:listing_fee, listing:, charged_per: "week")).not_to be_valid
    expect(build(:listing_fee, listing:, name: "Helmet", charged_per: "unit")).to be_valid
  end
end
