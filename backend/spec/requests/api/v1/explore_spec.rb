require "swagger_helper"

# The cases of the "Destination search flow" design, section 4, on a small made-up map:
# boxes stand in for boundaries, and coordinates are near but not exactly the real ones.
RSpec.describe "Explore", type: :request do
  def box(west, south, east, north)
    "MULTIPOLYGON(((#{west} #{south}, #{east} #{south}, #{east} #{north}, #{west} #{north}, #{west} #{south})))"
  end

  def place(slug, kind, center, parent: nil, boundary: nil)
    create(:area, slug:, name: slug.titleize, kind:, parent:, center: "POINT(#{center})", boundary:)
  end

  def offer(area, title, point)
    create(:listing, area:, category: camera, title:, location: "POINT(#{point})")
  end

  def link(from, to, kind = "bundled", weight: 1)
    DestinationLink.create!(source: from, target: to, kind:, weight:)
  end

  let!(:camera) { create(:category, name: "Action camera") }

  let!(:cebu) { place("cebu", "province", "123.85 10.45", boundary: box(123.3, 9.4, 124.2, 11.4)) }
  let!(:bantayan) { place("bantayan-island", "island", "123.76 11.20", parent: cebu, boundary: box(123.70, 11.13, 123.83, 11.30)) }
  let!(:santa_fe) { place("santa-fe", "town", "123.80 11.16", parent: bantayan) }
  let!(:daanbantayan) { place("daanbantayan", "town", "124.00 11.25", parent: cebu) }
  let!(:malapascua) do
    place("malapascua", "island", "124.115 11.325", parent: daanbantayan, boundary: box(124.10, 11.31, 124.13, 11.34))
  end
  let!(:cebu_city) { place("cebu-city", "city", "123.89 10.31", parent: cebu, boundary: box(123.80, 10.25, 123.92, 10.45)) }
  let!(:mandaue) { place("mandaue", "city", "123.94 10.33", parent: cebu) }
  let!(:moalboal) { place("moalboal", "town", "123.396 9.945", parent: cebu) }
  let!(:badian) { place("badian", "town", "123.39 9.87", parent: cebu) }
  let!(:alegria) { place("alegria", "town", "123.40 9.76", parent: cebu) }
  let!(:oslob) { place("oslob", "town", "123.43 9.47", parent: cebu) }
  let!(:sagada) { place("sagada", "town", "120.90 17.08") }
  let!(:baguio) { place("baguio", "city", "120.59 16.41") }

  let!(:kota_park) { create(:landmark, area: bantayan, slug: "kota-park", name: "Kota Park", location: "POINT(123.7235 11.269)") }
  let!(:pescador) { create(:landmark, area: moalboal, slug: "pescador-island", name: "Pescador Island", location: "POINT(123.344 9.926)") }
  let!(:kawasan) { create(:landmark, area: badian, slug: "kawasan-falls", name: "Kawasan Falls", location: "POINT(123.37 9.81)") }
  let!(:hanging_coffins) do
    create(:landmark, area: sagada, slug: "hanging-coffins", name: "Hanging Coffins", location: "POINT(120.895 17.085)")
  end
  let!(:sumaguing) { create(:landmark, area: sagada, slug: "sumaguing-cave", name: "Sumaguing Cave", location: "POINT(120.91 17.07)") }
  let!(:draft_falls) { create(:landmark, :draft, area: moalboal, slug: "draft-falls", location: "POINT(123.40 9.95)") }

  let!(:santa_fe_scooter) { offer(santa_fe, "Santa Fe scooter", "123.80 11.16") }
  let!(:bantayan_boat) { offer(bantayan, "Bantayan boat tour", "123.72 11.17") }
  # Filed under Santa Fe, and its rounded pin (123.83) sits on the island's edge, but the
  # exact point is in the water just outside.
  let!(:coastal_kayak) { offer(santa_fe, "Coastal kayak", "123.8312 11.16") }
  let!(:malapascua_dive) { offer(malapascua, "Malapascua dive", "124.12 11.325") }
  let!(:daanbantayan_van) { offer(daanbantayan, "Daanbantayan van", "124.00 11.25") }
  let!(:city_camera) { offer(cebu_city, "Cebu City camera", "123.90 10.30") }
  let!(:mandaue_bike) { offer(mandaue, "Mandaue bike", "123.935 10.335") }
  let!(:moalboal_gopro) { offer(moalboal, "Moalboal GoPro", "123.368 9.933") }
  let!(:badian_tour) { offer(badian, "Badian canyoneering", "123.39 9.88") }
  let!(:alegria_room) { offer(alegria, "Alegria room", "123.40 9.76") }
  let!(:oslob_tour) { offer(oslob, "Oslob whale shark tour", "123.43 9.47") }
  let!(:sagada_room) { offer(sagada, "Sagada inn", "120.90 17.08") }
  let!(:baguio_room) { offer(baguio, "Baguio hotel", "120.59 16.41") }
  let!(:pending_tour) { create(:listing, :pending, area: moalboal, category: camera, location: "POINT(123.37 9.94)") }

  before do
    link(moalboal, badian)
    link(moalboal, kawasan, weight: 3)
    link(badian, kawasan, weight: 2)
    link(bantayan, malapascua, "adjacent")
    link(sagada, baguio, "adjacent")
    link(sagada, hanging_coffins)
    link(cebu_city, moalboal)
    link(cebu_city, oslob)
  end

  def slugs(json, group)
    json[group].map { |entry| entry["slug"] || entry["title"] }
  end

  path "/api/v1/explore" do
    get "Listings, nearby destinations and recommendations for a destination" do
      tags "Discovery"
      produces "application/json"
      description "One starting point (an area, a published landmark or a map pin) and what makes sense for it. " \
        "Listings are scoped by the kind of place: a province, city or island returns what is inside it, a town, " \
        "landmark or pin what is within `km`. Anything on an island is isolated to that island, measured on the " \
        "listing's exact point. Nearby destinations are areas and landmarks within `km` (inside a province). " \
        "Recommendations are curated destination links: they may cross water, never add listings, and are not " \
        "repeated as nearby destinations. Listing locations are rounded to about 1 km."
      parameter name: :area, in: :query, type: :string, required: false, description: "Area slug"
      parameter name: :landmark, in: :query, type: :string, required: false, description: "Published landmark slug"
      parameter name: :lat, in: :query, type: :number, required: false, description: "Map pin latitude, with lng"
      parameter name: :lng, in: :query, type: :number, required: false, description: "Map pin longitude, with lat"
      parameter name: :km, in: :query, type: :number, required: false, description: "Radius, 1 to 50 (default 15)"

      response "200", "a province: every listing inside it" do
        schema "$ref" => "#/components/schemas/explore"
        let(:area) { "cebu" }

        run_test! do |response|
          json = response.parsed_body
          expect(json["anchor"]).to eq("type" => "area", "slug" => "cebu", "name" => "Cebu", "kind" => "province",
            "isolated_to" => nil, "location" => { "lat" => 10.45, "lng" => 123.85 })
          expect(slugs(json, "listings")).to contain_exactly("Santa Fe scooter", "Bantayan boat tour", "Coastal kayak",
            "Malapascua dive", "Daanbantayan van", "Cebu City camera", "Mandaue bike", "Moalboal GoPro",
            "Badian canyoneering", "Alegria room", "Oslob whale shark tour")
          expect(slugs(json, "destinations")).to include("cebu-city", "moalboal", "bantayan-island")
          expect(slugs(json, "destinations")).not_to include("cebu", "sagada", "draft-falls")
          expect(json["recommendations"]).to eq([])
        end
      end

      response "200", "an island: isolated, measured on each listing's exact point" do
        schema "$ref" => "#/components/schemas/explore"
        let(:area) { "bantayan-island" }

        run_test! do |response|
          json = response.parsed_body
          expect(json["anchor"]["isolated_to"]).to eq("slug" => "bantayan-island", "name" => "Bantayan Island")
          expect(slugs(json, "listings")).to contain_exactly("Santa Fe scooter", "Bantayan boat tour")
          expect(slugs(json, "destinations")).to contain_exactly("santa-fe", "kota-park")
          recommendation = json["recommendations"].sole
          expect(recommendation).to include("type" => "area", "slug" => "malapascua", "name" => "Malapascua",
            "kind" => "island", "area_slug" => "malapascua", "reason" => "adjacent")
          expect(recommendation["distance_km"]).to be_within(1).of(41)
        end
      end

      response "200", "a town: everything within km, across town borders" do
        schema "$ref" => "#/components/schemas/explore"
        let(:area) { "moalboal" }
        let(:km) { 15 }

        run_test! do |response|
          json = response.parsed_body
          expect(json["anchor"]["isolated_to"]).to be_nil
          expect(slugs(json, "listings")).to eq([ "Moalboal GoPro", "Badian canyoneering" ])
          expect(json["listings"].first).to include("area_slug" => "moalboal", "location" => { "lat" => 9.93, "lng" => 123.37 })
          expect(json["listings"].first["distance_km"]).to be_within(0.2).of(3.3)
          expect(slugs(json, "destinations")).to eq([ "pescador-island" ])
          # Badian is near and linked: it shows once, as a recommendation. Heaviest link first,
          # then nearest; Badian's own link to Kawasan Falls counts too.
          expect(slugs(json, "recommendations")).to eq(%w[kawasan-falls badian cebu-city])
          expect(json["recommendations"].first).to include("type" => "landmark", "reason" => "bundled")
        end
      end

      response "200", "an island under a town: the nearest island wins" do
        schema "$ref" => "#/components/schemas/explore"
        let(:area) { "malapascua" }

        run_test! do |response|
          json = response.parsed_body
          expect(json["anchor"]["isolated_to"]).to eq("slug" => "malapascua", "name" => "Malapascua")
          expect(slugs(json, "listings")).to eq([ "Malapascua dive" ])
          expect(slugs(json, "recommendations")).to eq([ "bantayan-island" ])
        end
      end

      response "200", "a landmark: measured from its own point, with its area's links" do
        schema "$ref" => "#/components/schemas/explore"
        let(:landmark) { "kawasan-falls" }

        run_test! do |response|
          json = response.parsed_body
          expect(json["anchor"]).to include("type" => "landmark", "slug" => "kawasan-falls", "kind" => nil,
            "location" => { "lat" => 9.81, "lng" => 123.37 })
          expect(slugs(json, "listings")).to eq([ "Alegria room", "Badian canyoneering", "Moalboal GoPro" ])
          expect(slugs(json, "destinations")).to eq(%w[alegria pescador-island])
          expect(slugs(json, "recommendations")).to eq(%w[moalboal badian])
          expect(json["recommendations"].last).to include("type" => "area", "kind" => "town", "area_slug" => "badian",
            "location" => { "lat" => 9.87, "lng" => 123.39 })
        end
      end

      response "200", "a pin on an island: off-island listings dropped even within km" do
        schema "$ref" => "#/components/schemas/explore"
        let(:lat) { 11.2 }
        let(:lng) { 123.76 }
        let(:km) { 50 }

        run_test! do |response|
          json = response.parsed_body
          expect(json["anchor"]).to eq("type" => "pin", "slug" => nil, "name" => nil, "kind" => nil,
            "isolated_to" => { "slug" => "bantayan-island", "name" => "Bantayan Island" },
            "location" => { "lat" => 11.2, "lng" => 123.76 })
          expect(slugs(json, "listings")).to contain_exactly("Santa Fe scooter", "Bantayan boat tour")
          expect(slugs(json, "destinations")).to contain_exactly("santa-fe", "kota-park")
          expect(slugs(json, "recommendations")).to eq([ "malapascua" ])
        end
      end

      response "200", "a city: only what is inside it, but destinations and links beyond" do
        schema "$ref" => "#/components/schemas/explore"
        let(:area) { "cebu-city" }

        run_test! do |response|
          json = response.parsed_body
          expect(slugs(json, "listings")).to eq([ "Cebu City camera" ])
          expect(slugs(json, "destinations")).to eq([ "mandaue" ])
          expect(slugs(json, "recommendations")).to contain_exactly("moalboal", "oslob")
        end
      end

      response "200", "a linked landmark that is also near shows once, as a recommendation" do
        schema "$ref" => "#/components/schemas/explore"
        let(:area) { "sagada" }

        run_test! do |response|
          json = response.parsed_body
          expect(slugs(json, "listings")).to eq([ "Sagada inn" ])
          expect(slugs(json, "destinations")).to eq([ "sumaguing-cave" ])
          expect(slugs(json, "recommendations")).to eq(%w[hanging-coffins baguio])
          expect(json["recommendations"].first).to include("type" => "landmark", "kind" => nil, "area_slug" => "sagada")
        end
      end

      response "200", "an island without a boundary falls back to the areas under it" do
        schema "$ref" => "#/components/schemas/explore"
        let!(:camotes) { place("camotes", "island", "124.40 10.65", parent: cebu) }
        let!(:pilar) { place("pilar", "town", "124.41 10.66", parent: camotes) }
        let!(:pilar_boat) { offer(pilar, "Pilar boat", "124.41 10.66") }
        let!(:danao_bike) { offer(cebu_city, "Danao bike", "124.30 10.60") }
        let(:area) { "pilar" }

        run_test! do |response|
          json = response.parsed_body
          expect(json["anchor"]["isolated_to"]).to eq("slug" => "camotes", "name" => "Camotes")
          expect(slugs(json, "listings")).to eq([ "Pilar boat" ])
        end
      end

      response "200", "a pin outside every area: a plain radius" do
        schema "$ref" => "#/components/schemas/explore"
        let(:lat) { 9.95 }
        let(:lng) { 123.28 }
        let(:km) { 14 }

        run_test! do |response|
          json = response.parsed_body
          expect(json["anchor"]["isolated_to"]).to be_nil
          expect(slugs(json, "listings")).to eq([ "Moalboal GoPro" ])
          expect(slugs(json, "destinations")).to eq([ "pescador-island", "moalboal" ])
          expect(slugs(json, "recommendations")).to eq(%w[kawasan-falls badian cebu-city])
        end
      end

      response "404", "unknown area" do
        schema "$ref" => "#/components/schemas/error"
        let(:area) { "atlantis" }

        run_test!
      end

      response "404", "a draft landmark" do
        schema "$ref" => "#/components/schemas/error"
        let(:landmark) { "draft-falls" }

        run_test!
      end

      response "422", "no starting point" do
        schema "$ref" => "#/components/schemas/validation_errors"

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Give an area, a landmark, or a lat and lng" ])
        end
      end

      response "422", "two starting points" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:area) { "moalboal" }
        let(:lat) { 9.9 }
        let(:lng) { 123.4 }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Give only one of an area, a landmark, or a lat and lng" ])
        end
      end

      response "422", "a pin needs both lat and lng" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:lat) { 9.9 }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Lng is required with lat" ])
        end
      end

      response "422", "values out of range or not numbers" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:lat) { "north" }
        let(:lng) { 200 }
        let(:km) { 60 }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly("Lat must be a number from -90 to 90",
            "Lng must be a number from -180 to 180", "Km must be a number from 1 to 50")
        end
      end
    end
  end
end
