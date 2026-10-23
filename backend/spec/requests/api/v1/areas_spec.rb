require "swagger_helper"

RSpec.describe "Areas", type: :request do
  let!(:cebu) { create(:area, slug: "cebu", name: "Cebu", kind: "province") }
  let!(:bantayan) { create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island", parent: cebu) }
  let!(:cebu_city) { create(:area, slug: "cebu-city", name: "Cebu City", kind: "city", parent: cebu) }
  let!(:empty_area) { create(:area, slug: "oslob", name: "Oslob") }

  let!(:swimming) { create(:tag, slug: "swimming", name: "Swimming") }
  let!(:snorkelling) { create(:tag, slug: "snorkelling", name: "Snorkelling") }
  let!(:white_sand) { create(:tag, slug: "white-sand", name: "White sand", kind: "feature") }

  let!(:kota) do
    create(:landmark, area: bantayan, slug: "kota-beach", name: "Kota Beach", description: "Sandbar beach",
      tags: [ swimming, white_sand ])
  end
  let!(:virgin) { create(:landmark, area: bantayan, slug: "virgin-island", name: "Virgin Island", tags: [ swimming, snorkelling ]) }
  let!(:draft) { create(:landmark, :draft, area: bantayan, slug: "draft-cove", name: "Draft Cove", tags: [ snorkelling ]) }
  let!(:fort) { create(:landmark, area: cebu_city, slug: "fort-san-pedro", name: "Fort San Pedro") }

  let!(:tour) { create(:category, slug: "tour", name: "Tour", booking_type: "activity") }
  let!(:scooter) do
    create(:category, slug: "motorcycle", name: "Motorcycle", unit_name: "motorcycle", unit_name_plural: "motorcycles")
  end
  let!(:hopping) do
    create(:listing, area: bantayan, category: tour, title: "Island hopping", partner: create(:user, :partner, :business),
      description: "\n  Four islands and a sandbar in one day.  \nLunch included.")
  end
  let(:basilia) { create(:business, name: "Basilia Motor Rentals") }
  let!(:honda) do
    create(:listing, area: bantayan, category: scooter, title: "Honda Click 125", partner: basilia.partner, business: basilia,
      attrs: { "make" => "Honda", "plate_no" => "BTN 4521", "engine_cc" => 125, "transmission" => "automatic",
        "amenities" => [ "rider_helmet" ] })
  end

  before { honda.units.create!((2..50).map { |position| { position: } }) }
  let!(:paused) { create(:listing, :paused, area: bantayan, category: scooter, title: "Paused scooter") }
  let!(:walk) { create(:listing, area: cebu_city, category: tour, title: "Heritage walk") }

  path "/api/v1/areas" do
    get "Destinations with something to book" do
      tags "Discovery"
      produces "application/json"
      description "Areas with at least one active listing, most listings first, each with its top three " \
        "activities (by how many published landmarks carry them)."

      response "200", "bookable areas" do
        schema type: :array, items: { "$ref" => "#/components/schemas/area_card" }

        run_test! do |response|
          json = response.parsed_body
          expect(json.pluck("slug")).to eq(%w[bantayan-island cebu-city])
          expect(json.first).to eq(
            "slug" => "bantayan-island", "name" => "Bantayan Island", "kind" => "island", "parent_name" => "Cebu",
            "parent_slug" => "cebu",
            "landmark_count" => 2, "listing_count" => 2, "to_book_count" => 2,
            "activities" => [ { "slug" => "swimming", "name" => "Swimming", "kind" => "activity" },
                              { "slug" => "snorkelling", "name" => "Snorkelling", "kind" => "activity" } ]
          )
        end
      end
    end
  end

  path "/api/v1/areas/{slug}" do
    get "A destination: its landmarks and what to book there" do
      tags "Discovery"
      produces "application/json"
      parameter name: :slug, in: :path, type: :string

      response "200", "published landmarks and active listings" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }

        run_test! do |response|
          json = response.parsed_body
          expect(json["area"]).to include("slug" => "bantayan-island", "parent_name" => "Cebu", "parent_slug" => "cebu")
          expect(json["areas"]).to be_empty
          expect(json["landmarks"].pluck("slug")).to eq(%w[kota-beach virgin-island])
          expect(json["landmarks"].first).to include("description" => "Sandbar beach", "visited_by" => [])
          expect(json["landmarks"].first["tags"].pluck("slug")).to eq(%w[swimming white-sand])
          expect(json["listings"]).to contain_exactly(
            { "id" => hopping.id, "title" => "Island hopping", "category" => "Tour", "group" => "activity", "area_slug" => "bantayan-island", "area_name" => "Bantayan Island",
              "instant_book" => false, "cover_photo_url" => nil, "booking_type" => "activity", "summary" => "Four islands and a sandbar in one day.",
              "business" => { "id" => hopping.business_id, "name" => "Moalboal Gear Rentals" }, "units_count" => 1, "units_label" => "1 unit",
              "partner_name" => "Moalboal Gear Rentals", "price_from_cents" => nil, "price_unit" => nil,
              "photos" => [], "details" => {}, "tour" => nil, "cancellation_policy" => "free_cancellation" },
            { "id" => honda.id, "title" => "Honda Click 125", "category" => "Motorcycle", "group" => "rental",
              "area_slug" => "bantayan-island", "area_name" => "Bantayan Island", "instant_book" => false, "cover_photo_url" => nil,
              "booking_type" => "rental", "summary" => "",
              "business" => { "id" => basilia.id, "name" => "Basilia Motor Rentals" }, "units_count" => 50, "units_label" => "50 motorcycles",
              "partner_name" => "Basilia Motor Rentals", "price_from_cents" => nil, "price_unit" => nil,
              "photos" => [], "details" => { "engine_cc" => 125, "transmission" => "automatic", "amenities" => [ "rider_helmet" ] }, "tour" => nil,
              "cancellation_policy" => "free_cancellation" }
          )
        end
      end

      response "200", "the listings of the places inside it, however deep, with their place's name" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }
        let!(:santa_fe) { create(:area, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan) }
        let!(:port) { create(:area, slug: "santa-fe-port", name: "Santa Fe Port", parent: santa_fe) }
        let!(:hidden) { create(:area, :draft, slug: "madridejos", name: "Madridejos", kind: "town", parent: bantayan) }

        before do
          create(:listing, area: santa_fe, category: tour, title: "Santa Fe kayaks")
          create(:listing, area: port, category: tour, title: "Port transfer")
          create(:listing, area: hidden, category: tour, title: "Draft town tour")
          create(:listing, :paused, area: santa_fe, category: tour, title: "Paused kayaks")
        end

        run_test! do |response|
          rows = response.parsed_body["listings"]
          expect(rows.pluck("title")).to eq([ "Honda Click 125", "Island hopping", "Port transfer", "Santa Fe kayaks" ])
          expect(rows.find { _1["title"] == "Santa Fe kayaks" }).to include("area_slug" => "santa-fe", "area_name" => "Santa Fe")
        end
      end

      response "200", "a place to see names the active listings that visit it" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }

        before do
          ListingLandmark.create!(listing: hopping, landmark: virgin, relation: "visits")
          ListingLandmark.create!(listing: paused, landmark: virgin, relation: "visits")
          ListingLandmark.create!(listing: honda, landmark: virgin, relation: "serves")
        end

        run_test! do |response|
          landmarks = response.parsed_body["landmarks"].index_by { _1["slug"] }
          expect(landmarks["virgin-island"]["visited_by"]).to eq([ hopping.id ])
          expect(landmarks["kota-beach"]["visited_by"]).to eq([])
        end
      end

      response "200", "a row carries its first ready photos (RAA-124)" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }

        before do
          create_photo(honda, ready: false)
          7.times { create_photo(honda) }
        end

        run_test! do |response|
          row = response.parsed_body["listings"].find { _1["id"] == honda.id }
          expect(row["photos"].size).to eq(6)
          expect(row["photos"].first.keys).to eq(%w[card_url large_url])
        end
      end

      response "200", "a stay's row says its nightly price once it has one (RAA-104)" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }

        before do
          island = Area.find_by!(slug: "bantayan-island")
          create(:listing, :stay, area: island, title: "Kota Beach house")
          create(:listing, :stay, area: island, title: "Unpriced house").stay_rate.update_columns(nightly_price_cents: 0)
        end

        run_test! do |response|
          rows = response.parsed_body["listings"].index_by { _1["title"] }
          expect(rows["Kota Beach house"].values_at("price_from_cents", "price_unit")).to eq([ 200_000, "night" ])
          expect(rows["Unpriced house"]["price_from_cents"]).to be_nil
        end
      end

      response "200", "a tour's row says its kind and the group it takes" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }
        let!(:joiner) { create(:listing, :tour, category: tour, area: bantayan, title: "Sandbar joiner") }

        run_test! do |response|
          row = response.parsed_body["listings"].find { _1["id"] == joiner.id }
          expect(row["tour"]).to eq("tour_type" => "joiner", "min_guests" => 2, "max_guests" => 12)
        end
      end

      response "200", "a province lists the areas under it that have something to book, and everything to book in them" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "cebu" }
        let!(:mactan) { create(:area, slug: "mactan", name: "Mactan", parent: cebu) }

        run_test! do |response|
          json = response.parsed_body
          expect(json["areas"].pluck("slug")).to eq(%w[bantayan-island cebu-city])
          expect(json["landmarks"]).to be_empty
          expect(json["listings"].pluck("title")).to eq([ "Heritage walk", "Honda Click 125", "Island hopping" ])
        end
      end

      response "404", "a draft area" do
        schema "$ref" => "#/components/schemas/error"
        let!(:draft_area) { create(:area, :draft, slug: "olango-island", name: "Olango Island", kind: "island", parent: cebu) }
        let(:slug) { "olango-island" }

        run_test!
      end

      response "404", "unknown area" do
        schema "$ref" => "#/components/schemas/error"
        let(:slug) { "atlantis" }

        run_test!
      end
    end
  end

  # What an area's page counts to book (its banner, What to book's All): one card per business per
  # guest group, the places inside it included, so the home page's destinations say the same number.
  describe "to_book_count" do
    let!(:santa_fe) { create(:area, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan) }

    it "counts each business once per group, over the area and the places inside it" do
      # Basilia's second scooter, in Santa Fe: the same card as its Honda on Bantayan Island.
      create(:listing, area: santa_fe, category: scooter, title: "Yamaha Mio", partner: basilia.partner, business: basilia)
      # A tour from Basilia: another group, another card.
      create(:listing, area: santa_fe, category: tour, title: "Sunset cruise", partner: basilia.partner, business: basilia)

      get "/api/v1/areas"

      counts = response.parsed_body.to_h { |area| [ area["slug"], area["to_book_count"] ] }
      expect(counts).to eq("bantayan-island" => 3, "santa-fe" => 2, "cebu-city" => 1)
    end
  end
end
