require "swagger_helper"

RSpec.describe "Partner businesses", type: :request do
  let(:address) do
    { street: "Sitio Maricaban", city: "Santa Fe", province: "Cebu", region: "Central Visayas",
      postal_code: "6047", country: "PH" }
  end
  let(:location) { { lat: 11.155, lng: 123.805 } }

  path "/api/v1/partner/businesses" do
    get "The signed-in partner's businesses" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. The businesses the partner runs (RAA-100), by name. Each listing belongs to one " \
        "of them, and guests see its name."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }

      response "200", "only the partner's own businesses, by name, with their listing counts" do
        schema type: :array, items: { "$ref" => "#/components/schemas/partner_business" }

        before do
          motors = create(:business, partner: user, name: "basilia Motor Rentals")
          create(:business, partner: user, name: "Basilia Guest House")
          create(:business, name: "Someone else's business")
          create_list(:listing, 2, partner: user, business: motors)
        end

        run_test! do |response|
          expect(response.parsed_body.pluck("name")).to eq([ "Basilia Guest House", "basilia Motor Rentals" ])
          expect(response.parsed_body.pluck("listings_count")).to eq([ 0, 2 ])
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

    post "Add a business" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only. `name` is required, up to 80 characters, and unique among the partner's " \
        "businesses ignoring case; `description` is optional. `address` and `location` (the map pin) are " \
        "required: a new listing can copy them (\"Same as Business Address\")."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/business_body" }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }
      let(:body) do
        { name: "  Basilia Guest House ", description: "Five rooms by the beach.", address:, location: }
      end

      response "201", "added, with its address and map pin" do
        schema "$ref" => "#/components/schemas/partner_business"

        run_test! do |response|
          expect(response.parsed_body).to include(
            "name" => "Basilia Guest House", "description" => "Five rooms by the beach.", "listings_count" => 0,
            "address" => address.stringify_keys, "location" => { "lat" => 11.155, "lng" => 123.805 }
          )
          expect(user.businesses.sole.name).to eq("Basilia Guest House")
        end
      end

      response "201", "without a description" do
        schema "$ref" => "#/components/schemas/partner_business"
        let(:body) { { name: "Basilia Motor Rentals", address:, location: } }

        run_test! { |response| expect(response.parsed_body["description"]).to eq("") }
      end

      response "201", "a name another partner already uses" do
        schema "$ref" => "#/components/schemas/partner_business"

        before { create(:business, name: "Basilia Guest House") }

        run_test!
      end

      response "422", "a name the partner already uses, in another case" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { create(:business, partner: user, name: "BASILIA guest house") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Name has already been taken")
        end
      end

      response "422", "a missing name, and a description that isn't text" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { description: 5, address:, location: } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Name is required", "Description must be text")
          expect(Business.count).to eq(0)
        end
      end

      response "422", "no address or map pin" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { name: "Basilia Guest House" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Address must be an object", "Location is required")
          expect(Business.count).to eq(0)
        end
      end

      response "422", "an incomplete address and a pin off the map" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { name: "Basilia Guest House", address: address.merge(city: " ", region: 5), location: { lat: 91, lng: "123" } } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(
            "City is required", "Region is required",
            "Latitude must be a number between -90 and 90", "Longitude must be a number between -180 and 180"
          )
        end
      end

      response "422", "a name too long" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { name: "x" * 81, address:, location: } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Name is too long (maximum is 80 characters)")
        end
      end

      response "422", "a blank name" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { name: "  ", address:, location: } }

        run_test! { |response| expect(response.parsed_body["errors"]).to include("Name is required") }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test! { expect(Business.count).to eq(0) }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/partner/businesses/{id}" do
    parameter name: :id, in: :path, schema: { type: :integer }
    parameter name: :Authorization, in: :header, schema: { type: :string }

    let(:user) { create(:user, :partner) }
    let(:Authorization) { bearer_for(user) }
    let(:business) { create(:business, partner: user, name: "Basilia Guest House") }
    let(:id) { business.id }

    get "One of the signed-in partner's businesses" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Another partner's business is a 404."
      security [ { bearer: [] } ]

      response "200", "the partner's business" do
        schema "$ref" => "#/components/schemas/partner_business"

        run_test! { |response| expect(response.parsed_body["name"]).to eq("Basilia Guest House") }
      end

      response "404", "another partner's business" do
        schema "$ref" => "#/components/schemas/error"
        let(:id) { create(:business).id }

        run_test!
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { bearer_for(create(:user)) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end

    patch "Rename a business or change its description" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only. The same body and rules as adding one, except that `description`, `address` and " \
        "`location` are kept when left out. Another partner's business is a 404."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/business_body" }

      let(:body) { { name: "Basilia Beach Rooms" } }

      response "200", "saved; a description, address and pin left out are kept" do
        schema "$ref" => "#/components/schemas/partner_business"

        before { business.update!(description: "By the beach.") }

        run_test! do |response|
          expect(response.parsed_body).to include("name" => "Basilia Beach Rooms", "description" => "By the beach.")
          expect(response.parsed_body["address"]).to include("city" => "Moalboal")
          expect(response.parsed_body["location"]).to eq("lat" => 9.933, "lng" => 123.368)
        end
      end

      response "200", "an address and pin given to a business that had none" do
        schema "$ref" => "#/components/schemas/partner_business"

        let(:business) do
          create(:business, partner: user, street: nil, city: nil, province: nil, region: nil, postal_code: nil,
            location: nil)
        end
        let(:body) { { name: "Basilia Beach Rooms", address:, location: } }

        run_test! do |response|
          expect(response.parsed_body["address"]).to eq(address.stringify_keys)
          expect(response.parsed_body["location"]).to eq("lat" => 11.155, "lng" => 123.805)
        end
      end

      response "422", "an address sent incomplete" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { name: "Basilia Beach Rooms", address: address.except(:street) } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Street is required")
          expect(business.reload.street).to eq("Panagsama Beach")
        end
      end

      response "422", "a blank name" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { name: "" } }

        run_test! { expect(business.reload.name).to eq("Basilia Guest House") }
      end

      response "404", "another partner's business" do
        schema "$ref" => "#/components/schemas/error"
        let(:other) { create(:business, name: "Not yours") }
        let(:id) { other.id }

        run_test! { expect(other.reload.name).to eq("Not yours") }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { bearer_for(create(:user)) }

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
