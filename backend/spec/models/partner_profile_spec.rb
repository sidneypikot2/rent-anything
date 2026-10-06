require "rails_helper"

RSpec.describe PartnerProfile do
  it "is valid from the factory" do
    expect(build(:partner_profile)).to be_valid
  end

  it "belongs to a partner, not a guest" do
    profile = build(:partner_profile, user: create(:user))

    expect(profile).not_to be_valid
    expect(profile.errors[:user]).to include("must be a partner")
  end

  it "requires the legal name and the whole address" do
    profile = build(:partner_profile, legal_first_name: nil, street: "", postal_code: nil)

    expect(profile).not_to be_valid
    expect(profile.errors.attribute_names).to include(:legal_first_name, :street, :postal_code)
  end

  it "takes a two-letter country code only" do
    expect(build(:partner_profile, country: "Philippines")).not_to be_valid
    expect(build(:partner_profile, country: "ph")).not_to be_valid
  end

  it "allows one profile per partner" do
    profile = create(:partner_profile)

    expect { create(:partner_profile, user: profile.user) }.to raise_error(ActiveRecord::RecordInvalid)
  end
end
