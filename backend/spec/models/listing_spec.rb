require "rails_helper"

RSpec.describe Listing do
  let(:schema) do
    { "type" => "object", "properties" => { "seats" => { "type" => "integer" } }, "required" => [ "seats" ] }
  end
  let(:van) { create(:category, slug: "van", name: "Van", booking_type: "transfer", attribute_schema: schema) }

  it "is valid with attrs that match its category's schema" do
    expect(build(:listing, category: van, attrs: { "seats" => 12 })).to be_valid
  end

  it "checks attrs against the category's schema" do
    listing = build(:listing, category: van, attrs: { "seats" => "twelve" })

    expect(listing).not_to be_valid
    expect(listing.errors[:attrs]).to be_present
  end

  it "belongs to a bookable (leaf) category only" do
    listing = build(:listing, category: create(:category, :parent))

    expect(listing).not_to be_valid
    expect(listing.errors[:category]).to include("must be a bookable category")
  end

  it "is owned by a partner" do
    listing = build(:listing, partner: create(:user))

    expect(listing).not_to be_valid
    expect(listing.errors[:partner]).to include("must be a partner")
  end

  it "can't be owned by a guest even bypassing validations" do
    listing = build(:listing, partner: create(:user))

    expect { listing.save!(validate: false) }.to raise_error(ActiveRecord::InvalidForeignKey)
  end

  it "only allows known statuses" do
    expect(build(:listing, status: "archived")).not_to be_valid
  end

  it "is free to cancel unless the partner chose otherwise" do
    expect(build(:listing).cancellation_policy).to eq("free_cancellation")
  end

  it "only allows the cancellation policies we offer" do
    listing = build(:listing, cancellation_policy: "thirty_days")

    expect(listing).not_to be_valid
    expect { listing.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid, /cancellation_policy_check/)
  end
end
