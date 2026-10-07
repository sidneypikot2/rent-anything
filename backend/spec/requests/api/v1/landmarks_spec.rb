require "swagger_helper"

RSpec.describe "Landmarks", type: :request do
  let(:moalboal) { create(:area, slug: "moalboal", name: "Moalboal") }

  before do
    create(:landmark, area: moalboal, slug: "pescador-island", name: "Pescador Island", location: "POINT(123.34412 9.92637)")
    create(:landmark, area: moalboal, slug: "kawasan-falls", name: "Kawasan Falls", location: "POINT(123.37905 9.80321)")
    create(:landmark, :draft, area: moalboal, name: "Draft spot")
  end

  path "/api/v1/landmarks" do
    get "Published landmarks with their location" do
      tags "Discovery"
      produces "application/json"
      description "Every published landmark, by name, with its exact location: landmarks are public places."

      response "200", "published landmarks" do
        schema type: :array, items: { "$ref" => "#/components/schemas/landmark_pin" }

        run_test! do |response|
          expect(response.parsed_body).to eq([
            { "slug" => "kawasan-falls", "name" => "Kawasan Falls", "area_slug" => "moalboal",
              "location" => { "lat" => 9.80321, "lng" => 123.37905 } },
            { "slug" => "pescador-island", "name" => "Pescador Island", "area_slug" => "moalboal",
              "location" => { "lat" => 9.92637, "lng" => 123.34412 } }
          ])
        end
      end
    end
  end
end
