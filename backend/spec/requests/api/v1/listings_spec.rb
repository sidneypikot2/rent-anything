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
              "cover_photo_url" => nil, "location" => { "lat" => 9.93, "lng" => 123.39 } },
            { "id" => gopro.id, "title" => "GoPro Hero 12", "category" => "Action camera", "area_slug" => "moalboal",
              "cover_photo_url" => nil, "location" => { "lat" => 9.95, "lng" => 123.37 } }
          ])
        end
      end
    end
  end

  path "/api/v1/listings/{id}" do
    get "One active listing, as a traveller sees it" do
      tags "Discovery"
      produces "application/json"
      description "An active listing's description, category, area, business and number of units. Never its " \
        "location or address: " \
        "the exact point is revealed only after a paid booking. Draft and pending listings are a 404."
      parameter name: :id, in: :path, type: :integer

      response "200", "an active listing" do
        schema "$ref" => "#/components/schemas/listing_detail"
        let(:tour) { create(:category, slug: "tour", name: "Tour", booking_type: "activity") }
        let(:id) do
          create(:listing, area: moalboal, category: tour, title: "Sardine run snorkel",
            partner: create(:user, :partner, :business), description: "#{"Swim with the sardines. " * 10}\nFins included.").id
        end

        run_test! do |response|
          json = response.parsed_body
          expect(json).to include(
            "id" => id, "title" => "Sardine run snorkel", "booking_type" => "activity",
            "category" => { "slug" => "tour", "name" => "Tour" }, "area" => { "slug" => "moalboal", "name" => "Moalboal" },
            "business" => { "name" => "Moalboal Gear Rentals" }, "units_count" => 1, "units_label" => "1 unit",
            "partner_name" => "Moalboal Gear Rentals"
          )
          expect(json["description"]).to end_with("\nFins included.")
          expect(json["summary"].length).to eq(160)
          expect(json["summary"]).to end_with("…")
          expect(json.keys).not_to include("location", "street", "address")
        end
      end

      response "200", "units in the category's words" do
        schema "$ref" => "#/components/schemas/listing_detail"
        let(:id) { gopro.id }

        before do
          camera.update!(unit_name: "camera", unit_name_plural: "cameras")
          gopro.units.create!([ { position: 2 }, { position: 3 } ])
        end

        run_test! do |response|
          expect(response.parsed_body).to include("units_count" => 3, "units_label" => "3 cameras", "summary" => "")
        end
      end

      response "200", "its photos in the partner's order, and the first as the cover in lists" do
        schema "$ref" => "#/components/schemas/listing_detail"
        let(:id) { gopro.id }

        before do
          gopro.photos.create!(position: 2, image: uploaded_photo(filename: "side.jpg"))
          gopro.photos.create!(position: 1, image: uploaded_photo(filename: "front.jpg"))
        end

        run_test! do |detail|
          photos = detail.parsed_body["photos"]
          expect(photos.size).to eq(2)
          expect(photos.first.keys).to contain_exactly("card_url", "large_url")
          expect(photos.first["large_url"]).to include("front")

          get "/api/v1/listings"
          pin = response.parsed_body.find { |row| row["id"] == gopro.id }
          expect(pin["cover_photo_url"]).to include("front")
          expect(response.parsed_body.find { |row| row["id"] == osmo.id }["cover_photo_url"]).to be_nil
        end
      end

      response "404", "a pending listing" do
        schema "$ref" => "#/components/schemas/error"
        let(:id) { Listing.find_by!(title: "Pending camera").id }

        run_test!
      end

      response "404", "a draft listing" do
        schema "$ref" => "#/components/schemas/error"
        let(:id) { Listing.find_by!(title: "Draft camera").id }

        run_test!
      end

      response "404", "an unknown listing" do
        schema "$ref" => "#/components/schemas/error"
        let(:id) { 0 }

        run_test!
      end
    end
  end
end
