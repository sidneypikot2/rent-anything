require "swagger_helper"

RSpec.describe "Guest profile", type: :request do
  path "/api/v1/me/profile" do
    get "The signed-in guest's profile" do
      tags "Auth"
      produces "application/json"
      description "Guest-only (a partner's is /api/v1/partner/profile). Fields are null until the profile " \
        "is first saved; `complete` drives the web app's banner."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user) }
      let(:Authorization) { bearer_for(user) }

      response "200", "not filled in yet" do
        schema "$ref" => "#/components/schemas/guest_profile"

        run_test! do |response|
          expect(response.parsed_body).to include("legal_first_name" => nil, "email" => user.email, "complete" => false)
          expect(response.parsed_body["address"]).to include("street" => nil, "country" => nil)
        end
      end

      response "200", "a saved profile" do
        schema "$ref" => "#/components/schemas/guest_profile"
        let(:user) { create(:user, :profile_complete) }

        before { create(:guest_profile, user: user) }

        run_test! do |response|
          expect(response.parsed_body).to include("legal_first_name" => "Ana", "phone" => "+639171234567",
                                                  "complete" => true)
          expect(response.parsed_body["address"]).to include("city" => "City of Makati", "province" => nil)
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end

    put "Save the signed-in guest's profile" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "Guest-only. Every field is required except `address.province`; `phone` is saved on the " \
        "user. Email can't be changed here."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          legal_first_name: { type: :string },
          legal_last_name: { type: :string },
          phone: { type: :string },
          address: {
            type: :object,
            properties: {
              street: { type: :string },
              city: { type: :string },
              region: { type: :string },
              province: { type: :string, nullable: true, description: "Optional: none in Metro Manila" },
              postal_code: { type: :string },
              country: { type: :string, description: "ISO 3166-1 alpha-2, e.g. PH" }
            },
            required: %w[street city region postal_code country]
          }
        },
        required: %w[legal_first_name legal_last_name phone address]
      }

      let(:user) { create(:user) }
      let(:Authorization) { bearer_for(user) }
      let(:address) do
        { street: "Poblacion East", city: "Moalboal", province: "Cebu", region: "Central Visayas",
          postal_code: "6032", country: "PH" }
      end
      let(:body) { { legal_first_name: "Ana", legal_last_name: "Reyes", phone: "+639171234567", address: address } }

      response "200", "profile saved" do
        schema "$ref" => "#/components/schemas/guest_profile"

        run_test! do |response|
          expect(response.parsed_body).to include("legal_last_name" => "Reyes", "complete" => true)
          expect(user.reload.phone).to eq("+639171234567")
          expect(user.guest_profile).to have_attributes(city: "Moalboal", province: "Cebu", postal_code: "6032")
        end
      end

      response "200", "saving again updates the same profile; no province in Metro Manila" do
        schema "$ref" => "#/components/schemas/guest_profile"
        before { create(:guest_profile, user: user) }
        let(:body) do
          { legal_first_name: "Ana", legal_last_name: "Reyes", phone: "+639171234567",
            address: address.merge(city: "City of Makati", region: "National Capital Region", province: " ") }
        end

        run_test! do
          expect(GuestProfile.where(user: user).count).to eq(1)
          expect(user.reload.guest_profile).to have_attributes(city: "City of Makati", province: nil)
        end
      end

      response "200", "a display name and an email are ignored" do
        schema "$ref" => "#/components/schemas/guest_profile"
        let(:body) do
          { legal_first_name: "Ana", legal_last_name: "Reyes", phone: "+639171234567", address: address,
            display_name: "Ana's Trips", email: "other@example.com" }
        end

        run_test! do |response|
          expect(response.parsed_body).not_to have_key("display_name")
          expect(user.reload.email).not_to eq("other@example.com")
        end
      end

      response "422", "a required field is missing" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { legal_first_name: "Ana", phone: "+639171234567", address: address } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Last name is required")
          expect(user.reload.guest_profile).to be_nil
        end
      end

      response "422", "a blank address field" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) do
          { legal_first_name: "Ana", legal_last_name: "Reyes", phone: "+639171234567",
            address: address.merge(street: "  ") }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Street is required")
        end
      end

      response "422", "an address that isn't an object" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { legal_first_name: "Ana", legal_last_name: "Reyes", phone: "+639171234567", address: "Cebu" } }

        run_test!
      end

      response "422", "a province given as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) do
          { legal_first_name: "Ana", legal_last_name: "Reyes", phone: "+639171234567",
            address: address.merge(province: 72) }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Province must be text")
        end
      end

      response "422", "a country that isn't a two-letter code" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) do
          { legal_first_name: "Ana", legal_last_name: "Reyes", phone: "+639171234567",
            address: address.merge(country: "Philippines") }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Country must be a two-letter country code")
        end
      end

      response "422", "a phone that isn't a phone number saves nothing" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { legal_first_name: "Ana", legal_last_name: "Reyes", phone: "abc", address: address } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Phone must be a phone number")
          expect(user.reload.guest_profile).to be_nil
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

        run_test! do
          expect(GuestProfile.count).to eq(0)
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
