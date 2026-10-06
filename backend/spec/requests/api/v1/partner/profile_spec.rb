require "swagger_helper"

RSpec.describe "Partner profile", type: :request do
  path "/api/v1/partner/profile" do
    get "The signed-in partner's profile" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Fields are null until the profile is first saved; `complete` drives the web app's banner."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }

      response "200", "not filled in yet" do
        schema "$ref" => "#/components/schemas/partner_profile"

        run_test! do |response|
          expect(response.parsed_body).to include(
            "legal_first_name" => nil, "email" => user.email, "complete" => false
          )
          expect(response.parsed_body["address"]).to include("street" => nil, "country" => nil)
        end
      end

      response "200", "a saved profile" do
        schema "$ref" => "#/components/schemas/partner_profile"
        let(:user) { create(:user, :partner, :profile_complete) }

        before { create(:partner_profile, user: user, display_name: "Jun's Moto Rentals") }

        run_test! do |response|
          expect(response.parsed_body).to include(
            "display_name" => "Jun's Moto Rentals", "legal_first_name" => "Jun", "phone" => "+639171234567",
            "complete" => true
          )
          expect(response.parsed_body["address"]).to include("city" => "Moalboal", "country" => "PH")
        end
      end

      response "200", "a saved profile without a phone is not complete" do
        schema "$ref" => "#/components/schemas/partner_profile"

        before { create(:partner_profile, user: user) }

        run_test! do |response|
          expect(response.parsed_body["complete"]).to be(false)
        end
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

    put "Save the signed-in partner's profile" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only. Every field but `display_name` is required; `phone` is saved on the user. " \
        "Email can't be changed here."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          display_name: { type: :string, nullable: true },
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

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }
      let(:address) do
        { street: "Poblacion East", city: "Moalboal", province: "Cebu", region: "Central Visayas", postal_code: "6032",
          country: "PH" }
      end
      let(:body) do
        { display_name: "Jun's Moto Rentals", legal_first_name: "Jun", legal_last_name: "Dela Cruz",
          phone: "+63 917 123 4567", address: address }
      end

      response "200", "profile saved" do
        schema "$ref" => "#/components/schemas/partner_profile"

        run_test! do |response|
          expect(response.parsed_body).to include("legal_last_name" => "Dela Cruz", "complete" => true)
          expect(user.reload.phone).to eq("+63 917 123 4567")
          expect(user.partner_profile).to have_attributes(city: "Moalboal", province: "Cebu", postal_code: "6032", country: "PH")
        end
      end

      response "200", "saving again updates the same profile; a blank display name is cleared" do
        schema "$ref" => "#/components/schemas/partner_profile"
        before { create(:partner_profile, user: user, display_name: "Old name") }
        let(:body) do
          { display_name: " ", legal_first_name: "Jun", legal_last_name: "Dela Cruz",
            phone: "+639171234567", address: address.merge(city: "Badian") }
        end

        run_test! do
          expect(PartnerProfile.where(user: user).count).to eq(1)
          expect(user.reload.partner_profile).to have_attributes(display_name: nil, city: "Badian")
        end
      end

      response "200", "email is ignored" do
        schema "$ref" => "#/components/schemas/partner_profile"
        let(:body) do
          { legal_first_name: "Jun", legal_last_name: "Dela Cruz", phone: "+639171234567",
            address: address, email: "other@example.com" }
        end

        run_test! do
          expect(user.reload.email).not_to eq("other@example.com")
        end
      end

      response "200", "no province, as in Metro Manila; a blank one is stored as null" do
        schema "$ref" => "#/components/schemas/partner_profile"
        let(:body) do
          { legal_first_name: "Jun", legal_last_name: "Dela Cruz", phone: "+639171234567",
            address: address.merge(city: "City of Makati", region: "National Capital Region", province: " ") }
        end

        run_test! do |response|
          expect(response.parsed_body["address"]).to include("province" => nil, "city" => "City of Makati")
          expect(user.reload.partner_profile.province).to be_nil
        end
      end

      response "422", "a province given as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) do
          { legal_first_name: "Jun", legal_last_name: "Dela Cruz", phone: "+639171234567",
            address: address.merge(province: 72) }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Province must be text")
        end
      end

      response "422", "a name with digits saves nothing" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) do
          { legal_first_name: "Jun", legal_last_name: "Dela Cruz 2", phone: "+639171234567", address: address }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"])
            .to include("Last name can only have letters, spaces, hyphens, apostrophes and periods")
          expect(user.reload.partner_profile).to be_nil
          expect(user.phone).to be_nil
        end
      end

      response "422", "a required field is missing" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { legal_first_name: "Jun", phone: "+639171234567", address: address } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Last name is required")
          expect(user.reload.partner_profile).to be_nil
        end
      end

      response "422", "a blank address field" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) do
          { legal_first_name: "Jun", legal_last_name: "Dela Cruz", phone: "+639171234567",
            address: address.merge(postal_code: "  ") }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("ZIP code is required")
        end
      end

      response "422", "an address that isn't an object" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) do
          { legal_first_name: "Jun", legal_last_name: "Dela Cruz", phone: "+639171234567", address: "Moalboal" }
        end

        run_test!
      end

      response "422", "a field given as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) do
          { legal_first_name: "Jun", legal_last_name: "Dela Cruz", phone: "+639171234567",
            address: address.merge(postal_code: 6032) }
        end

        run_test!
      end

      response "422", "a country that isn't a two-letter code" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) do
          { legal_first_name: "Jun", legal_last_name: "Dela Cruz", phone: "+639171234567",
            address: address.merge(country: "Philippines") }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Country must be a two-letter country code")
        end
      end

      response "422", "a phone that isn't a phone number saves nothing" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) do
          { legal_first_name: "Jun", legal_last_name: "Dela Cruz", phone: "abc", address: address }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Phone must be a phone number")
          expect(user.reload.partner_profile).to be_nil
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test! do
          expect(PartnerProfile.count).to eq(0)
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
