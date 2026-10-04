require "rails_helper"

RSpec.describe "Auth::Providers" do
  around do |example|
    env = { "GOOGLE_CLIENT_ID" => "google-client", "FACEBOOK_APP_ID" => "fb-app", "FACEBOOK_APP_SECRET" => "fb-secret" }
    original = env.keys.index_with { |key| ENV[key] }
    env.each { |key, value| ENV[key] = value }
    example.run
  ensure
    original.each { |key, value| ENV[key] = value }
  end

  describe Auth::Providers::Google do
    it "returns the profile from a token issued for our client id" do
      allow(Google::Auth::IDTokens).to receive(:verify_oidc).with("id-token", aud: "google-client")
        .and_return("sub" => "g-1", "email" => "ana@example.com", "email_verified" => true, "name" => "Ana")

      expect(described_class.verify("id-token"))
        .to eq(uid: "g-1", email: "ana@example.com", email_verified: true, name: "Ana")
    end

    it "rejects a token that fails verification" do
      allow(Google::Auth::IDTokens).to receive(:verify_oidc)
        .and_raise(Google::Auth::IDTokens::AudienceMismatchError)

      expect { described_class.verify("id-token") }.to raise_error(NotAuthenticatedError)
    end

    it "refuses when no client id is configured" do
      ENV["GOOGLE_CLIENT_ID"] = nil

      expect { described_class.verify("id-token") }.to raise_error(NotAuthenticatedError, /not configured/)
    end
  end

  describe Auth::Providers::Facebook do
    let(:debug) { { "data" => { "is_valid" => true, "app_id" => "fb-app", "user_id" => "fb-1" } } }
    let(:me) { { "id" => "fb-1", "name" => "Ana", "email" => "ana@example.com" } }

    before do
      allow(described_class).to receive(:get).with("/debug_token", anything).and_return(debug)
      allow(described_class).to receive(:get).with("/me", anything).and_return(me)
    end

    it "returns the profile, with the email not treated as verified" do
      expect(described_class.verify("fb-token"))
        .to eq(uid: "fb-1", email: "ana@example.com", email_verified: false, name: "Ana")
    end

    it "rejects a token issued to another app" do
      debug["data"]["app_id"] = "someone-elses-app"

      expect { described_class.verify("fb-token") }.to raise_error(NotAuthenticatedError)
    end

    it "rejects an invalid token" do
      debug["data"]["is_valid"] = false

      expect { described_class.verify("fb-token") }.to raise_error(NotAuthenticatedError)
    end

    it "rejects a profile that doesn't match the token's user" do
      me["id"] = "fb-2"

      expect { described_class.verify("fb-token") }.to raise_error(NotAuthenticatedError)
    end
  end
end
