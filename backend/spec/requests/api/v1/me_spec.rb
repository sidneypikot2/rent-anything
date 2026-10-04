require "swagger_helper"

RSpec.describe "Me", type: :request do
  let(:user) { create(:user, name: "Maria Santos", email: "maria@example.com") }
  let(:Authorization) { "Bearer #{JsonWebToken.encode(sub: user.id)}" }

  path "/api/v1/me" do
    get "The signed-in user" do
      tags "Auth"
      produces "application/json"
      security [ bearer: [] ]

      response "200", "the user the access token belongs to" do
        schema "$ref" => "#/components/schemas/user"

        run_test! do
          expect(response.parsed_body).to include("id" => user.id, "email" => "maria@example.com")
        end
      end

      response "401", "no valid access token" do
        schema "$ref" => "#/components/schemas/error"

        context "without a token" do
          let(:Authorization) { nil }

          run_test!
        end

        context "with a garbage token" do
          let(:Authorization) { "Bearer not.a.jwt" }

          run_test!
        end

        context "with an expired token" do
          let(:Authorization) { "Bearer #{JsonWebToken.encode(sub: user.id, expires_in: -1.minute)}" }

          run_test!
        end

        context "with a token signed by someone else" do
          let(:Authorization) { "Bearer #{JWT.encode({ sub: user.id, exp: 1.hour.from_now.to_i }, "other", "HS256")}" }

          run_test!
        end

        context "when the user no longer exists" do
          let(:Authorization) { "Bearer #{JsonWebToken.encode(sub: 0)}" }

          run_test!
        end
      end
    end

    patch "Update the signed-in user's profile" do
      tags "Auth"
      description "Only name and phone; email, role and password are not changed here."
      consumes "application/json"
      produces "application/json"
      security [ bearer: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          user: {
            type: :object,
            properties: { name: { type: :string }, phone: { type: :string, nullable: true } }
          }
        },
        required: %w[user]
      }

      let(:body) { { user: { name: "Maria S.", phone: "0917 123 4567" } } }

      response "200", "the updated user" do
        schema "$ref" => "#/components/schemas/user"

        context "with a new name and phone" do
          run_test! do
            expect(response.parsed_body).to include("name" => "Maria S.", "phone" => "09171234567")
          end
        end

        context "with a role and email in the request, which are ignored" do
          let(:body) { { user: { name: "Maria", role: "admin", email: "evil@example.com" } } }

          run_test! do
            expect(user.reload).to have_attributes(role: "guest", email: "maria@example.com")
          end
        end
      end

      response "422", "invalid values" do
        schema "$ref" => "#/components/schemas/validation_errors"

        context "when the name is blank" do
          let(:body) { { user: { name: "" } } }

          run_test! do
            expect(response.parsed_body["errors"]).to include("Name can't be blank")
          end
        end

        context "when the name is a hash" do
          let(:body) { { user: { name: { "first" => "Maria" } } } }

          run_test! do
            expect(response.parsed_body["errors"]).to include("Name must be a string")
            expect(user.reload.name).to eq("Maria Santos")
          end
        end
      end

      response "401", "no valid access token" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
