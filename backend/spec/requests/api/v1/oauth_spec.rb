require "swagger_helper"

RSpec.describe "OAuth", type: :request do
  path "/api/v1/oauth/{provider}" do
    post "Sign in or sign up with Google or Facebook" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "`token` is a Google Identity Services ID token or a Facebook Login access token. " \
        "It signs in to, links or creates an account of `role` only, so one Google account can " \
        "have a guest and a partner account."
      parameter name: :provider, in: :path, schema: { type: :string, enum: %w[google facebook] }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          token: { type: :string },
          role: { type: :string, enum: %w[guest partner] }
        },
        required: %w[token role]
      }

      let(:provider) { "google" }
      let(:body) { { token: "google-id-token", role: "guest" } }
      let(:profile) { { uid: "g-123", email: "ana@example.com", email_verified: true, name: "Ana Reyes" } }

      before { allow(Auth::Providers::Google).to receive(:verify).with("google-id-token").and_return(profile) }

      response "200", "a guest's Google account on /partner/login gets its own partner account" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        let(:body) { { token: "google-id-token", role: "partner" } }
        let!(:guest) do
          create(:user, :oauth_only, email: "ana@example.com").tap do |user|
            user.oauth_identities.create!(provider: "google", uid: "g-123")
          end
        end

        run_test! do |response|
          expect(response.parsed_body["user"]).to include("email" => "ana@example.com", "role" => "partner")
          expect(response.parsed_body.dig("user", "id")).not_to eq(guest.id)
          expect(OauthIdentity.where(provider: "google", uid: "g-123").pluck(:role)).to contain_exactly("guest", "partner")
        end
      end

      response "200", "a new user is created with the entry point's role" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        let(:body) { { token: "google-id-token", role: "partner" } }

        run_test! do |response|
          expect(response.parsed_body["user"]).to include("email" => "ana@example.com", "role" => "partner")
          expect(OauthIdentity.find_by(provider: "google", uid: "g-123")).to be_present
        end
      end

      response "401", "the provider rejects the token" do
        schema "$ref" => "#/components/schemas/error"

        before do
          allow(Auth::Providers::Google).to receive(:verify).and_raise(NotAuthenticatedError, "Google sign-in failed")
        end

        run_test!
      end

      response "404", "unknown provider" do
        schema "$ref" => "#/components/schemas/error"
        let(:provider) { "myspace" }

        run_test!
      end

      response "422", "the email belongs to a password account, which is never linked" do
        schema "$ref" => "#/components/schemas/validation_errors"
        before { create(:user, email: "ana@example.com") }

        run_test! { expect(OauthIdentity.count).to eq(0) }
      end

      response "422", "token missing" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { role: "guest" } }

        run_test!
      end

      response "429", "too many attempts from one IP" do
        schema "$ref" => "#/components/schemas/error"
        before { exceed_auth_rate_limit(Api::V1::OauthController) }

        run_test!
      end
    end
  end
end
