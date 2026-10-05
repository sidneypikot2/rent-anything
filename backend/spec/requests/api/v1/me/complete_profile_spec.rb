require "swagger_helper"

RSpec.describe "Complete profile", type: :request do
  path "/api/v1/me/complete_profile" do
    put "Finish sign-up with a name and phone" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "Sign-up asks only for email and password; the web app sends a user whose " \
        "`registration_complete` is false here before anything else. Both fields are required. " \
        "Guests and partners alike."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          name: { type: :string },
          phone: { type: :string, description: "Digits, spaces, ( ) - and a leading +; 7 to 20 characters" }
        },
        required: %w[name phone]
      }

      let(:user) { create(:user, name: nil) }
      let(:Authorization) { bearer_for(user) }
      let(:body) { { name: " Ana Reyes ", phone: " +63 917 123 4567 " } }

      response "200", "profile completed" do
        schema "$ref" => "#/components/schemas/user"

        run_test! do |response|
          expect(response.parsed_body).to include(
            "name" => "Ana Reyes", "phone" => "+63 917 123 4567", "registration_complete" => true
          )
          expect(user.reload.registration_complete).to be(true)
        end
      end

      response "200", "a partner completes theirs" do
        schema "$ref" => "#/components/schemas/user"
        let(:user) { create(:user, :partner) }

        run_test! do |response|
          expect(response.parsed_body).to include("role" => "partner", "registration_complete" => true)
        end
      end

      response "422", "phone missing" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { name: "Ana Reyes" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Phone is required")
          expect(user.reload.registration_complete).to be(false)
        end
      end

      response "422", "blank name" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(name: "  ") }

        run_test! { expect(user.reload.registration_complete).to be(false) }
      end

      response "422", "phone given as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(phone: 639_171_234_567) }

        run_test!
      end

      response "422", "phone that isn't a phone number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(phone: "call me") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Phone must be a phone number")
        end
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
