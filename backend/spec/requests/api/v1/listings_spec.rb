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
    create(:listing, :paused, area: moalboal, category: camera, title: "Paused camera")
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
        "the exact point is revealed only after a paid booking. Draft, paused and delisted listings are a 404."
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

      response "200", "its ready photos in the partner's order, and the first as the cover in lists" do
        schema "$ref" => "#/components/schemas/listing_detail"
        let(:id) { gopro.id }

        let!(:uploading) { create_photo(gopro, position: 1, uploaded: false) }
        let!(:resizing) { create_photo(gopro, position: 2, ready: false) }
        let!(:side) { create_photo(gopro, position: 4) }
        let!(:front) { create_photo(gopro, position: 3) }

        run_test! do |detail|
          photos = detail.parsed_body["photos"]
          expect(photos.size).to eq(2)
          expect(photos.first.keys).to contain_exactly("card_url", "large_url")
          expect(photos.first["large_url"]).to end_with("/listing_photos/#{front.id}/image_large.jpg")

          get "/api/v1/listings"
          pin = response.parsed_body.find { |row| row["id"] == gopro.id }
          expect(pin["cover_photo_url"]).to end_with("/listing_photos/#{front.id}/image_card.jpg")
          expect(response.parsed_body.find { |row| row["id"] == osmo.id }["cover_photo_url"]).to be_nil
        end
      end

      response "200", "a stay with its nightly pricing and fees (RAA-104)" do
        schema "$ref" => "#/components/schemas/listing_detail"
        let(:listing) { create(:listing, :stay, area: moalboal) }
        let(:id) { listing.id }

        before do
          listing.stay_rate.update!(weekend_price_cents: 250_000, extra_guest_fee_cents: 50_000, min_nights: 2)
          create(:listing_fee, listing:, name: "Cleaning fee", amount_cents: 80_000, position: 1)
        end

        run_test! do |response|
          json = response.parsed_body
          expect(json).to include("booking_type" => "stay", "price_from_cents" => 200_000, "guests" => 4)
          expect(json["stay_rate"]).to include("nightly_price_cents" => 200_000, "weekend_price_cents" => 250_000,
            "base_guests" => 2, "extra_guest_fee_cents" => 50_000, "min_nights" => 2)
          expect(json["fees"].sole).to include("name" => "Cleaning fee", "amount_cents" => 80_000, "required" => true)
        end
      end

      response "200", "a tour with its price per head and inclusions (RAA-110)" do
        schema "$ref" => "#/components/schemas/listing_detail"
        let(:listing) { create(:listing, :tour, area: moalboal) }
        let(:id) { listing.id }

        before do
          listing.tour_detail.update!(base_price_cents: 120_000)
          listing.tour_inclusions.create!(kind: "meal", options: %w[lunch])
        end

        run_test! do |response|
          json = response.parsed_body
          expect(json).to include("price_from_cents" => 120_000, "price_unit" => "person")
          expect(json["tour"]).to include(
            "tour_type" => "joiner", "min_guests" => 2, "max_guests" => 12, "duration_value" => 4,
            "duration_unit" => "hours", "price_unit" => "person",
            "inclusions" => [ { "kind" => "meal", "options" => %w[lunch], "note" => nil, "price_per_head_cents" => 0 } ]
          )
          expect(json["tour"].keys).not_to include("max_groups_per_day")
        end
      end

      response "200", "a tour with no price yet, and at most 5 of its photos" do
        schema "$ref" => "#/components/schemas/listing_detail"
        let(:listing) { create(:listing, :tour, area: moalboal) }
        let(:id) { listing.id }

        before do
          listing.tour_detail.update_columns(base_price_cents: 0)
          7.times { create_photo(listing) }
        end

        run_test! do |response|
          expect(response.parsed_body).to include("price_from_cents" => nil, "price_unit" => nil, "tour" => nil)
          expect(response.parsed_body["photos"].size).to eq(5)
        end
      end

      response "200", "a stay with no price yet, and a listing that isn't priced by the night" do
        schema "$ref" => "#/components/schemas/listing_detail"
        let(:listing) { create(:listing, :stay, area: moalboal) }
        let(:id) { listing.id }

        before { listing.stay_rate.update_columns(nightly_price_cents: 0) }

        run_test! do |unpriced|
          expect(unpriced.parsed_body).to include("price_from_cents" => nil, "stay_rate" => nil, "fees" => [])
          get "/api/v1/listings/#{gopro.id}"
          expect(response.parsed_body).to include("price_from_cents" => nil, "stay_rate" => nil, "guests" => nil)
        end
      end

      response "404", "a paused listing" do
        schema "$ref" => "#/components/schemas/error"
        let(:id) { Listing.find_by!(title: "Paused camera").id }

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
