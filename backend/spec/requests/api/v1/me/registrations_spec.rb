require "swagger_helper"

RSpec.describe "Me: register", type: :request do
  path "/api/v1/me/register" do
    post "Create an account to keep this trip" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "Guest-only (RAA-175). A guest who booked without an account sets a password (8 to 72 " \
        "characters) on the same account, which then signs in with email and password, and their trips are no " \
        "longer deleted 60 days after they end. Their trip link keeps working."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { password: { type: :string } }, required: %w[password]
      }

      let(:user) { create(:user, :profile_complete, password: nil, email: "ana@example.com") }
      let(:Authorization) { bearer_for(user) }
      let(:body) { { password: "keep-my-trip" } }

      response "200", "registered" do
        schema "$ref" => "#/components/schemas/user"

        run_test! do |response|
          expect(response.parsed_body).to include("registered" => true)
          expect(user.reload.authenticate("keep-my-trip")).to be_truthy
        end
      end

      response "422", "a guest with no email yet" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:Authorization) { bearer_for(User.create!(role: "guest")) }

        run_test!
      end

      response "422", "already has a password" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:user) { create(:user, password: "password123") }

        run_test! do
          expect(user.reload.authenticate("password123")).to be_truthy
        end
      end

      response "422", "too short" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { password: "short" } }

        run_test! do
          expect(user.reload.password_digest).to be_nil
        end
      end

      response "422", "sent as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { password: 12_345_678 } }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { bearer_for(create(:user, :partner, password: nil)) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
