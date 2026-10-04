require "swagger_helper"

RSpec.describe "Sessions", type: :request do
  path "/api/v1/session" do
    post "Sign in with email and password" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "`role` is the entry point signed in from; an account of another role gets 403."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          email: { type: :string },
          password: { type: :string },
          role: { type: :string, enum: %w[guest partner admin] }
        },
        required: %w[email password role]
      }

      let!(:user) { create(:user, email: "ana@example.com", password: "password123") }
      let(:body) { { email: "ANA@example.com ", password: "password123", role: "guest" } }

      response "200", "signed in" do
        schema "$ref" => "#/components/schemas/auth_tokens"

        run_test! do |response|
          expect(response.parsed_body.dig("user", "id")).to eq(user.id)
        end
      end

      response "401", "wrong password" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { super().merge(password: "wrong-password") }

        run_test!
      end

      response "401", "an account made with Google has no password" do
        schema "$ref" => "#/components/schemas/error"
        let!(:user) { create(:user, :oauth_only, email: "ana@example.com") }

        run_test!
      end

      response "403", "a guest account signing in on /partner/login" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { super().merge(role: "partner") }

        run_test! do |response|
          expect(response.parsed_body["error"]).to include("guest account")
        end
      end

      response "403", "a partner account signing in on /login" do
        schema "$ref" => "#/components/schemas/error"
        let!(:user) { create(:user, :partner, email: "ana@example.com", password: "password123") }

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
    end

    delete "Sign out (revoke a refresh token)" do
      tags "Auth"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { refresh_token: { type: :string } },
        required: %w[refresh_token]
      }

      let(:user) { create(:user) }
      let(:refresh_token) { Auth::IssueTokens.call(user)[:refresh_token] }
      let(:body) { { refresh_token: refresh_token } }

      response "204", "signed out" do
        run_test! do
          expect(RefreshToken.find_by_token(refresh_token).revoked_at).to be_present
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
