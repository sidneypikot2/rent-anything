require "rails_helper"

RSpec.describe OauthIdentity do
  it "takes its user's role" do
    user = create(:user, :partner)

    expect(user.oauth_identities.create!(provider: "google", uid: "g-1").role).to eq("partner")
  end

  # The composite foreign key keeps an identity's role in step with its user's.
  it "can't hold a role other than its user's" do
    identity = create(:user).oauth_identities.create!(provider: "google", uid: "g-1")

    expect { identity.update_column(:role, "partner") }.to raise_error(ActiveRecord::InvalidForeignKey)
  end
end
