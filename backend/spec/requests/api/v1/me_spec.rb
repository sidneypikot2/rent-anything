require "swagger_helper"

RSpec.describe "Me", type: :request do
  path "/api/v1/me" do
    get "The signed-in user" do
      tags "Auth"
      produces "application/json"
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user) }
      let(:Authorization) { bearer_for(user) }

      response "200", "the user" do
        schema "$ref" => "#/components/schemas/user"

        run_test! do |response|
          expect(response.parsed_body).to include("id" => user.id, "role" => "guest")
        end
      end

      response "401", "no token" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end

      response "401", "an expired token" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { "Bearer #{JsonWebToken.encode(sub: user.id.to_s, expires_in: -1.minute)}" }

        run_test!
      end
    end
  end

  path "/api/v1/partner/me" do
    get "The signed-in partner" do
      tags "Auth"
      produces "application/json"
      description "Partner-only, like everything under /api/v1/partner."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }

      response "200", "the partner" do
        schema "$ref" => "#/components/schemas/user"

        run_test!
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

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
