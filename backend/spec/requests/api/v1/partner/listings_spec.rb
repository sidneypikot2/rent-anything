require "swagger_helper"

RSpec.describe "Partner listings", type: :request do
  path "/api/v1/partner/listings" do
    get "The signed-in partner's listings" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Every listing the partner owns, in any status, ordered by category name, then " \
        "title. The exact location is included: the reader owns the listing."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }

      response "200", "only the partner's own listings, by category then title" do
        schema type: :array, items: { "$ref" => "#/components/schemas/partner_listing" }

        let(:camera) { create(:category, name: "Action camera") }
        let(:tour) { create(:category, name: "Tour", booking_type: "activity") }

        before do
          create(:listing, partner: user, category: tour, title: "Island hopping", status: "draft",
            location: "POINT(123.80 11.17)")
          create(:listing, partner: user, category: camera, title: "Insta360 X4")
          create(:listing, partner: user, category: camera, title: "GoPro Hero 12", status: "pending")
          create(:listing, category: camera, title: "Someone else's camera")
        end

        run_test! do |response|
          expect(response.parsed_body.pluck("title")).to eq([ "GoPro Hero 12", "Insta360 X4", "Island hopping" ])
          tour_row = response.parsed_body.last
          expect(tour_row).to include("status" => "draft", "location" => { "lat" => 11.17, "lng" => 123.80 })
          expect(tour_row["category"]).to include("name" => "Tour", "booking_type" => "activity")
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

    post "Add a listing" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only. The listing is saved as a draft; any `status` sent is ignored. `attrs` is checked " \
        "against the category's `attribute_schema` (see `GET /api/v1/partner/listing_options`). The listing's area " \
        "is the city, town or island nearest the pin, within 50 km."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          title: { type: :string, maxLength: 120 },
          description: { type: :string, maxLength: 5000 },
          category_id: { type: :integer, description: "A bookable (leaf) category" },
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
          },
          location: {
            type: :object,
            properties: {
              lat: { type: :number, minimum: -90, maximum: 90 },
              lng: { type: :number, minimum: -180, maximum: 180 }
            },
            required: %w[lat lng]
          },
          attrs: { type: :object, additionalProperties: true }
        },
        required: %w[title category_id address location]
      }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }
      let!(:area) { create(:area, slug: "moalboal", name: "Moalboal", center: "POINT(123.396 9.945)") }
      let(:address) do
        { street: "Panagsama Beach", city: "Moalboal", province: "Cebu", region: "Central Visayas",
          postal_code: "6032", country: "PH" }
      end
      let(:category) do
        create(:category, name: "Tour", booking_type: "activity", attribute_schema: {
          type: "object",
          required: [ "guide_included" ],
          properties: { guide_included: { type: "boolean" }, duration_hours: { type: "number" } }
        })
      end
      let(:body) do
        { title: "Sardine run and turtle snorkel", description: "Half a day off Panagsama.",
          category_id: category.id, address: address, location: { lat: 9.95, lng: 123.37 },
          attrs: { guide_included: true, duration_hours: 4 } }
      end

      response "201", "saved as a draft, in the area nearest the pin" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before do
          body[:status] = "active"
          create(:area, slug: "cebu-city", name: "Cebu City", center: "POINT(123.891 10.316)")
          create(:area, slug: "cebu", name: "Cebu", kind: "province", center: "POINT(123.39 9.95)")
        end

        run_test! do |response|
          expect(response.parsed_body).to include(
            "title" => "Sardine run and turtle snorkel", "status" => "draft",
            "location" => { "lat" => 9.95, "lng" => 123.37 },
            "attrs" => { "guide_included" => true, "duration_hours" => 4 }
          )
          expect(response.parsed_body["area"]).to eq("slug" => "moalboal", "name" => "Moalboal")
          expect(response.parsed_body["address"]).to eq(address.stringify_keys)
          expect(user.listings.sole).to have_attributes(status: "draft", category: category, area: area)
        end
      end

      response "201", "an address without a province" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before { body[:address] = address.merge(province: nil) }

        run_test! do |response|
          expect(response.parsed_body["address"]["province"]).to be_nil
        end
      end

      response "422", "a pin far from every destination" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:location] = { lat: 14.6, lng: 121.0 } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("No destination near this pin yet")
          expect(Listing.count).to eq(0)
        end
      end

      response "422", "attrs that don't match the category" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:attrs] = { duration_hours: "four" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to be_present
          expect(Listing.count).to eq(0)
        end
      end

      response "422", "a category that isn't bookable" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:category_id] = create(:category, :parent).id }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Category must be a bookable category")
        end
      end

      response "422", "an unknown category" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:category_id] = 0 }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Category is not one we know")
        end
      end

      response "422", "missing and wrong-typed values" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) do
          { title: 42, description: [ "x" ], category_id: "1", location: { lat: "9.95", lng: 200 }, attrs: "none",
            address: { street: "", city: 6032, province: 1, region: "Central Visayas" } }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(
            "Title is required", "Description must be text", "Category is required",
            "Street is required", "City is required", "Province must be text", "ZIP code is required",
            "Country is required",
            "Latitude must be a number between -90 and 90", "Longitude must be a number between -180 and 180",
            "Details must be an object"
          )
          expect(Listing.count).to eq(0)
        end
      end

      response "422", "a title or description too long" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body.merge!(title: "x" * 121, description: "x" * 5001) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(
            "Title is too long (maximum is 120 characters)", "Description is too long (maximum is 5000 characters)"
          )
        end
      end

      response "422", "an address that isn't an object" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:address] = "Panagsama Beach, Moalboal" }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Address must be an object")
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test! { expect(Listing.count).to eq(0) }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
