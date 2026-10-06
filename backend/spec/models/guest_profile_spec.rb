require "rails_helper"

RSpec.describe GuestProfile do
  it_behaves_like "a profile with a legal name", :guest_profile

  it "is valid from the factory, with no province (Metro Manila)" do
    expect(build(:guest_profile)).to be_valid
  end

  it "belongs to a guest, not a partner" do
    profile = build(:guest_profile, user: create(:user, :partner))

    expect(profile).not_to be_valid
    expect(profile.errors[:user]).to include("must be a guest")
  end

  it "requires the legal name and the whole address" do
    profile = build(:guest_profile, legal_last_name: nil, city: "", postal_code: nil)

    expect(profile).not_to be_valid
    expect(profile.errors.attribute_names).to include(:legal_last_name, :city, :postal_code)
  end

  it "takes a two-letter country code only" do
    expect(build(:guest_profile, country: "Philippines")).not_to be_valid
  end

  it "allows one profile per guest" do
    profile = create(:guest_profile)

    expect { create(:guest_profile, user: profile.user) }.to raise_error(ActiveRecord::RecordInvalid)
  end

  it "is refused by the database for a partner" do
    partner = create(:user, :partner)
    profile = build(:guest_profile, user: partner)

    expect { profile.save!(validate: false) }.to raise_error(ActiveRecord::InvalidForeignKey)
  end
end
