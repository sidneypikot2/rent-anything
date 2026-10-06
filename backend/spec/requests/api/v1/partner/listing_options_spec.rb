require "swagger_helper"

RSpec.describe "Partner listing options", type: :request do
  path "/api/v1/partner/listing_options" do
    get "What a new listing can be: bookable categories and areas" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Bookable (leaf) categories with the JSON Schema their `attrs` must match, and the " \
        "cities, towns and islands a listing can be in."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }

      response "200", "leaf categories and listable areas" do
        schema "$ref" => "#/components/schemas/listing_options"

        before do
          rentals = create(:category, :parent, name: "Rentals")
          create(:category, parent: rentals, name: "Action camera",
            attribute_schema: { type: "object", properties: { waterproof_m: { type: "number" } } })
          create(:category, name: "Tour", booking_type: "activity")
          cebu = create(:area, name: "Cebu", kind: "province")
          create(:area, name: "Moalboal", kind: "town", parent: cebu, center: "POINT(123.396 9.945)")
        end

        run_test! do |response|
          categories = response.parsed_body["categories"]
          expect(categories.pluck("name")).to eq([ "Action camera", "Tour" ])
          expect(categories.first).to include(
            "parent_name" => "Rentals", "booking_type" => "rental",
            "attribute_schema" => { "type" => "object", "properties" => { "waterproof_m" => { "type" => "number" } } }
          )
          expect(response.parsed_body["areas"]).to eq(
            [ { "slug" => Area.find_by!(name: "Moalboal").slug, "name" => "Moalboal", "kind" => "town",
                "parent_name" => "Cebu", "center" => { "lat" => 9.945, "lng" => 123.396 } } ]
          )
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
  end
end
