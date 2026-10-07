require "swagger_helper"

RSpec.describe "Listings", type: :request do
  let(:moalboal) { create(:area, slug: "moalboal", name: "Moalboal") }
  let(:camera) { create(:category, name: "Action camera") }
  let!(:gopro) do
    create(:listing, area: moalboal, category: camera, title: "GoPro Hero 12", location: "POINT(123.36789 9.94523)")
  end
  let!(:osmo) do
    create(:listing, area: moalboal, category: camera, title: "DJI Osmo Action", location: "POINT(123.39412 9.93251)")
  end

  before do
    create(:listing, :pending, area: moalboal, category: camera, title: "Pending camera")
    create(:listing, area: moalboal, category: camera, title: "Draft camera", status: "draft")
  end

  path "/api/v1/listings" do
    get "Active listings with their approximate location" do
      tags "Discovery"
      produces "application/json"
      description "Every active listing, by title, with its location rounded to two decimals (about 1 km). " \
        "The exact point is revealed only after a paid booking."

      response "200", "active listings, location rounded" do
        schema type: :array, items: { "$ref" => "#/components/schemas/listing_pin" }

        run_test! do |response|
          expect(response.parsed_body).to eq([
            { "id" => osmo.id, "title" => "DJI Osmo Action", "category" => "Action camera", "area_slug" => "moalboal",
              "location" => { "lat" => 9.93, "lng" => 123.39 } },
            { "id" => gopro.id, "title" => "GoPro Hero 12", "category" => "Action camera", "area_slug" => "moalboal",
              "location" => { "lat" => 9.95, "lng" => 123.37 } }
          ])
        end
      end
    end
  end
end
