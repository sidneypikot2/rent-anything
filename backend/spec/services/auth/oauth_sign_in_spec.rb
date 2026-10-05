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

  it "links Google to a passwordless account with the same verified email" do
    user = create(:user, :oauth_only, email: "ana@example.com")
    user.oauth_identities.create!(provider: "facebook", uid: "fb-1")

    expect(sign_in.dig(:user, "id")).to eq(user.id)
    expect(user.oauth_identities.pluck(:provider)).to contain_exactly("facebook", "google")
  end

  # Email sign-ups don't prove the address: linking would let whoever registered it first
  # share the real owner's account.
  it "never links to a password account, even with Google's verified email" do
    create(:user, email: "ana@example.com")

    expect { sign_in }.to raise_error(ActiveRecord::RecordInvalid, /already exists/)
    expect(OauthIdentity.count).to eq(0)
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

  it "keeps one account per role for the same provider account" do
    guest_id = sign_in(role: "guest").dig(:user, "id")
    partner_id = sign_in(role: "partner").dig(:user, "id")

    expect(partner_id).not_to eq(guest_id)
    expect(sign_in(role: "guest").dig(:user, "id")).to eq(guest_id)
    expect(sign_in(role: "partner").dig(:user, "id")).to eq(partner_id)
    expect(OauthIdentity.where(provider: "google", uid: "uid-1").count).to eq(2)
  end

  it "only links by email within the entry point's role" do
    guest = create(:user, :oauth_only, email: "ana@example.com")

    expect(sign_in(role: "partner").dig(:user, "id")).not_to eq(guest.id)
    expect(guest.oauth_identities).to be_empty
  end

  it "doesn't let a guest's password account block a partner sign-up with Google" do
    create(:user, email: "ana@example.com")

    expect(sign_in(role: "partner")[:user]).to include("role" => "partner")
  end

  it "refuses a provider account without an email" do
    allow(Auth::Providers::Google).to receive(:verify).and_return(profile.merge(email: nil))

    expect { sign_in }.to raise_error(ActiveRecord::RecordInvalid, /didn't share an email/)
  end

  it "never makes an admin" do
    expect { sign_in(role: "admin") }.to raise_error(ActiveRecord::RecordInvalid)
  end
end
