require "rails_helper"

RSpec.describe Auth::OauthSignIn do
  let(:profile) { { uid: "uid-1", email: "ana@example.com", email_verified: true, name: "Ana Reyes" } }

  before do
    allow(Auth::Providers::Google).to receive(:verify).and_return(profile)
    allow(Auth::Providers::Facebook).to receive(:verify).and_return(profile.merge(email_verified: false))
  end

  def sign_in(provider: "google", role: "guest")
    described_class.call(provider: provider, token: "token", role: role)
  end

  it "signs in the user already linked to the identity" do
    user = create(:user, :oauth_only, email: "other@example.com")
    user.oauth_identities.create!(provider: "google", uid: "uid-1")

    expect(sign_in.dig(:user, "id")).to eq(user.id)
    expect(User.count).to eq(1)
  end

  it "links Google to an existing account with the same verified email" do
    user = create(:user, email: "ana@example.com")

    expect(sign_in.dig(:user, "id")).to eq(user.id)
    expect(user.oauth_identities.pluck(:provider)).to eq([ "google" ])
  end

  it "doesn't link Facebook to an existing account, since its email isn't verified" do
    create(:user, email: "ana@example.com")

    expect { sign_in(provider: "facebook") }.to raise_error(ActiveRecord::RecordInvalid, /already exists/)
    expect(OauthIdentity.count).to eq(0)
  end

  it "creates a Facebook user when the email is new" do
    result = sign_in(provider: "facebook", role: "partner")

    expect(result[:user]).to include("email" => "ana@example.com", "role" => "partner")
  end

  it "refuses a linked identity whose user has another role" do
    user = create(:user, :partner)
    user.oauth_identities.create!(provider: "google", uid: "uid-1")

    expect { sign_in(role: "guest") }.to raise_error(NotAuthorizedError)
  end

  it "refuses a provider account without an email" do
    allow(Auth::Providers::Google).to receive(:verify).and_return(profile.merge(email: nil))

    expect { sign_in }.to raise_error(ActiveRecord::RecordInvalid, /didn't share an email/)
  end

  it "never makes an admin" do
    expect { sign_in(role: "admin") }.to raise_error(ActiveRecord::RecordInvalid)
  end
end
