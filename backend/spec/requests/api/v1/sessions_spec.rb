require "swagger_helper"

RSpec.describe "Sessions", type: :request do
  path "/api/v1/session" do
    post "Sign in with email and password" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "`role` is the entry point signed in from. Email is unique per role, so only that " \
        "role's account is looked up; an account of another role is not found (401)."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          email: { type: :string },
          password: { type: :string },
          role: { type: :string, enum: %w[guest partner admin] }
        },
        required: %w[email password role]
      }
      parameter name: :Authorization, in: :header, required: false, schema: { type: :string },
        description: "A guest with no account yet (RAA-175): their trips move into the account signed in to"
      refresh_cookie_header

      let!(:user) { create(:user, email: "ana@example.com", password: "password123") }
      let(:body) { { email: "ANA@example.com ", password: "password123", role: "guest" } }

      response "200", "a guest with no account yet signs in: their trips move into the account" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        let(:anonymous) { User.create!(role: "guest") }
        let!(:trip) { create(:trip, user: anonymous) }
        let(:Authorization) { bearer_for(anonymous) }

        run_test! do
          expect(trip.reload.user_id).to eq(user.id)
          expect(User.exists?(anonymous.id)).to be(false)
        end
      end

      response "200", "on /partner/login a guest's trips stay theirs" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        let!(:partner) { create(:user, :partner, email: "ana@example.com", password: "partner-pass") }
        let(:body) { { email: "ana@example.com", password: "partner-pass", role: "partner" } }
        let(:anonymous) { User.create!(role: "guest") }
        let!(:trip) { create(:trip, user: anonymous) }
        let(:Authorization) { bearer_for(anonymous) }

        run_test! { expect(trip.reload.user_id).to eq(anonymous.id) }
      end

      response "200", "the same email has a guest and a partner account: the page picks one" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        let!(:partner) { create(:user, :partner, email: "ana@example.com", password: "partner-pass") }
        let(:body) { { email: "ana@example.com", password: "partner-pass", role: "partner" } }

        run_test! do |response|
          expect(response.parsed_body["user"]).to include("id" => partner.id, "role" => "partner")
        end
      end

      response "200", "signed in" do
        schema "$ref" => "#/components/schemas/auth_tokens"

        run_test! do |response|
          expect(response.parsed_body.dig("user", "id")).to eq(user.id)
        end
      end

      response "401", "a guest account signing in on /partner/login" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { super().merge(role: "partner") }

        run_test!
      end

      response "401", "the guest's password on /partner/login, when the partner account has another" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { super().merge(role: "partner") }
        before { create(:user, :partner, email: "ana@example.com", password: "partner-pass") }

        run_test!
      end

      response "401", "wrong password" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { super().merge(password: "wrong-password") }

        run_test!
      end

      response "401", "an unknown email: the same answer as a wrong password" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { super().merge(email: "nobody@example.com") }

        run_test! do |unknown_email|
          unknown = [ unknown_email.status, unknown_email.body ]
          post "/api/v1/session", params: { email: "ana@example.com", password: "wrong-password", role: "guest" }, as: :json
          expect([ response.status, response.body ]).to eq(unknown)
        end
      end

      response "401", "an account made with Google has no password" do
        schema "$ref" => "#/components/schemas/error"
        let!(:user) { create(:user, :oauth_only, email: "ana@example.com") }

        run_test!
      end

      response "422", "password given as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(password: 12_345_678) }

        run_test!
      end

      response "422", "unknown role" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(role: "superuser") }

        run_test!
      end

      response "429", "too many attempts: 10 in 3 minutes from one IP, or 10 in 15 minutes on one email from any IP" do
        schema "$ref" => "#/components/schemas/error"
        header "Retry-After", schema: { type: :integer }, description: "Seconds until the limit resets"
        before { exceed_rate_limit(Api::V1::SessionsController, ApplicationController::SIGN_IN_PER_EMAIL_LIMIT, name: "per_email") }

        run_test! do |response|
          expect(response.headers["Retry-After"]).to eq("900")
          # Counted on the email as typed, trimmed and in lower case.
          expect(Api::V1::SessionsController.cache_store).to have_received(:increment)
            .with("rate-limit:api/v1/sessions:per_email:ana@example.com", 1, expires_in: 15.minutes)
        end
      end

      response "429", "too many attempts: 10 in 3 minutes from one IP, or 10 in 15 minutes on one email from any IP" do
        schema "$ref" => "#/components/schemas/error"
        header "Retry-After", schema: { type: :integer }, description: "Seconds until the limit resets"
        before { exceed_auth_rate_limit(Api::V1::SessionsController) }

        run_test!
      end
    end

    delete "Sign out (revoke a refresh token)" do
      tags "Auth"
      consumes "application/json"
      description "With `X-Refresh-Cookie: 1` the `raa_refresh` cookie's token is revoked and the cookie deleted; " \
        "otherwise the body's."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { refresh_token: { type: :string, description: "Required unless the cookie carries it" } }
      }
      refresh_cookie_header "`1`: revoke the `raa_refresh` cookie's token and delete the cookie (RAA-306)"

      let(:user) { create(:user) }
      let(:refresh_token) { Auth::IssueTokens.call(user)[:refresh_token] }
      let(:body) { { refresh_token: refresh_token } }

      response "204", "signed out" do
        run_test! do
          expect(RefreshToken.find_by_token(refresh_token).revoked_at).to be_present
          # Its open WebSockets close, so each reconnects only with a token still valid (RAA-224).
          expect(ActionCable.server.pubsub.broadcasts("action_cable/#{user.to_gid_param}").map { JSON.parse(_1) })
            .to include({ "type" => "disconnect", "reconnect" => true })
        end
      end

      response "204", "an unknown token is ignored" do
        let(:body) { { refresh_token: "not-a-token" } }

        run_test!
      end

      response "422", "token missing" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { {} }

        run_test!
      end
    end
  end
end
