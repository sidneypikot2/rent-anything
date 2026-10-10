require "swagger_helper"

RSpec.describe "Partner listing options", type: :request do
  path "/api/v1/partner/listing_options" do
    get "What a new listing can be: its bookable categories and cancellation policies" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Bookable (leaf) categories, each with what it means and the JSON Schema " \
        "its `attrs` must match, and the cancellation policies a listing can have."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }

      response "200", "leaf categories" do
        schema "$ref" => "#/components/schemas/listing_options"

        before do
          rentals = create(:category, :parent, name: "Rentals")
          create(:category, parent: rentals, name: "Action camera", description: "A camera for the water",
            attribute_schema: { type: "object", properties: { waterproof_m: { type: "number" } } })
          create(:category, name: "Tour", booking_type: "activity")
        end

        run_test! do |response|
          categories = response.parsed_body["categories"]
          expect(categories.pluck("name")).to eq([ "Action camera", "Tour" ])
          expect(categories.first).to include(
            "parent_name" => "Rentals", "booking_type" => "rental", "description" => "A camera for the water",
            "attribute_schema" => { "type" => "object", "properties" => { "waterproof_m" => { "type" => "number" } } }
          )
          expect(response.parsed_body["cancellation_policies"].pluck("value")).to eq(
            %w[free_cancellation non_refundable seven_days fourteen_days]
          )
          expect(response.parsed_body["cancellation_policies"].first).to include("name" => "Free cancellation")
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
