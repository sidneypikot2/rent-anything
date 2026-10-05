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
end
