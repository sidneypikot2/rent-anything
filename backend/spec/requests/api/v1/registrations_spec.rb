require "swagger_helper"

RSpec.describe "Registrations", type: :request do
  path "/api/v1/registrations" do
    post "Sign up as a guest or a partner" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          user: {
            type: :object,
            properties: {
              name: { type: :string },
              email: { type: :string },
              password: { type: :string, minLength: 8, maxLength: 72 },
              phone: { type: :string, nullable: true },
              role: { type: :string, enum: %w[guest partner], default: "guest" }
            },
            required: %w[name email password]
          }
        },
        required: %w[user]
      }

      let(:attrs) { { name: "Maria Santos", email: "  Maria@Example.com ", password: "correct horse" } }
      let(:body) { { user: attrs } }

      response "201", "the account is created and signed in" do
        schema "$ref" => "#/components/schemas/session"

        context "as a guest, by default" do
          run_test! do
            json = response.parsed_body
            expect(json["user"]).to include("email" => "maria@example.com", "role" => "guest", "phone" => nil)
            expect(JsonWebToken.decode(json["access_token"])[:sub]).to eq(json["user"]["id"])
            expect(json["expires_in"]).to eq(15.minutes.to_i)
          end
        end

        context "as a partner (a sign-up from /partner)" do
          let(:attrs) { super().merge(role: "partner", phone: "+63 917-123-4567") }

          run_test! do
            expect(response.parsed_body["user"]).to include("role" => "partner", "phone" => "+639171234567")
          end
        end
      end

      response "422", "the request is invalid" do
        schema "$ref" => "#/components/schemas/validation_errors"

        context "when asking for an admin account" do
          let(:attrs) { super().merge(role: "admin") }

          run_test! do
            expect(response.parsed_body["errors"]).to include("Role is not included in the list")
            expect(User.count).to eq(0)
          end
        end

        context "when the role is not a role" do
          let(:attrs) { super().merge(role: "owner") }

          run_test!
        end

        context "when the email is taken, in any case" do
          before { create(:user, email: "maria@example.com") }

          run_test! do
            expect(response.parsed_body["errors"]).to include("Email has already been taken")
          end
        end

        context "when the password is too short" do
          let(:attrs) { super().merge(password: "short") }

          run_test! do
            expect(response.parsed_body["errors"]).to include(a_string_starting_with("Password is too short"))
          end
        end

        context "when the password is over bcrypt's 72 bytes" do
          let(:attrs) { super().merge(password: "a" * 73) }

          run_test!
        end

        context "when the email is not an email" do
          let(:attrs) { super().merge(email: "maria") }

          run_test!
        end

        context "when the phone is not a phone number" do
          let(:attrs) { super().merge(phone: "call me") }

          run_test! do
            expect(response.parsed_body["errors"]).to include("Phone is invalid")
          end
        end

        context "when a value is a hash instead of a string" do
          let(:attrs) { super().merge(email: { "$ne" => "" }) }

          run_test! do
            expect(response.parsed_body["errors"]).to include("Email must be a string")
          end
        end

        context "when the user key is missing" do
          let(:body) { { name: "Maria" } }

          run_test!
        end
      end
    end
  end
end
