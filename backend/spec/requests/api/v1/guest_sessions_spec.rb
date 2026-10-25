require "swagger_helper"

RSpec.describe "Guest sessions", type: :request do
  path "/api/v1/guest_sessions" do
    post "Start as a guest without an account" do
      tags "Auth"
      produces "application/json"
      description "RAA-175. Makes a guest with no email, so a trip made before signing in has an owner, and signs " \
        "them in. They give name, email and phone at their first checkout (`contact` on POST /checkouts), and come " \
        "back later through their trip link and PIN."

      response "201", "a guest with no email yet" do
        schema "$ref" => "#/components/schemas/auth_tokens"

        run_test! do |response|
          user = response.parsed_body["user"]
          expect(user).to include("role" => "guest", "email" => nil, "registration_complete" => false,
            "registered" => false)
          expect(User.find(user["id"])).to be_anonymous
        end
      end

      response "429", "too many from one IP" do
        schema "$ref" => "#/components/schemas/error"
        before { exceed_auth_rate_limit(Api::V1::GuestSessionsController) }

        run_test! do
          expect(User.count).to eq(0)
        end
      end
    end
  end
end
