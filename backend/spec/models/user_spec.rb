require "rails_helper"

RSpec.describe User do
  it "allows the same email for a guest and a partner" do
    create(:user, email: "ana@example.com")

    expect(build(:user, :partner, email: "ANA@example.com")).to be_valid
  end

  it "rejects the same email twice for one role" do
    create(:user, :partner, email: "ana@example.com")

    expect(build(:user, :partner, email: "ana@example.com")).not_to be_valid
  end

  it "needs no name until the profile is complete" do
    expect(build(:user, name: nil)).to be_valid
  end

  it "needs a name and phone once the profile is complete" do
    user = build(:user, :profile_complete)

    expect(user).to be_valid
    user.phone = nil
    expect(user).not_to be_valid
  end

  it "is held to that by the database too" do
    user = create(:user)

    expect { user.update_columns(registration_complete: true) }.to raise_error(ActiveRecord::StatementInvalid)
  end
end
