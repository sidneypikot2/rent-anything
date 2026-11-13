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
      paginated_list
      description "Areas with at least one active listing, most listings first, each with its top three " \
        "activities (by how many published landmarks carry them)."

      include_examples "a paginated list", total: 2

      response "200", "bookable areas" do
        schema type: :array, items: { "$ref" => "#/components/schemas/area_card" }

        run_test! do |response|
          json = response.parsed_body
          expect(json.pluck("slug")).to eq(%w[bantayan-island cebu-city])
          expect(json.first).to eq(
            "slug" => "bantayan-island", "name" => "Bantayan Island", "kind" => "island", "parent_name" => "Cebu",
            "parent_slug" => "cebu", "center" => { "lat" => 9.945, "lng" => 123.396 },
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

      response "200", "the landmarks still name their visitors, and it counts its partners" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }
        before do
          ListingLandmark.create!(listing: hopping, landmark: virgin, relation: "visits")
          # A second listing of a business already here counts it once.
          create(:listing, area: bantayan, category: scooter, title: "Yamaha Mio", partner: basilia.partner, business: basilia)
        end

        run_test! do |response|
          json = response.parsed_body
          # Island hopping's and Basilia's: the paused scooter's business and Cebu City's don't count.
          expect(json["partner_count"]).to eq(2)
          # Its own middle, where its map starts.
          expect(json["center"]).to eq("lat" => bantayan.center.y.round(5), "lng" => bantayan.center.x.round(5))
          expect(json["landmarks"].find { _1["slug"] == "virgin-island" }["visited_by"]).to eq([ hopping.id ])
        end
      end

      response "200", "what it offers per group, its typical prices and the tours to its places" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }
        let(:inn) { create(:business, name: "Kota Beach Inn") }
        let(:guides) { create(:business, name: "Island Guides") }

        before do
          create(:listing, :stay, area: bantayan, title: "Kota garden room", partner: inn.partner, business: inn).stay_rate.update!(nightly_price_cents: 200_000)
          create(:listing, :stay, area: bantayan, title: "Kota beach suite", partner: inn.partner, business: inn).stay_rate.update!(nightly_price_cents: 300_000)
          create(:listing, :tour, area: bantayan, title: "Sunset sail tour", partner: guides.partner, business: guides).tour_detail.update!(base_price_cents: 100_000)
          create(:listing, :tour, area: bantayan, title: "Cave and lagoon tour", partner: guides.partner, business: guides)
          ListingLandmark.create!(listing: hopping, landmark: virgin, relation: "visits")
        end

        run_test! do |response|
          json = response.parsed_body
          expect(json["groups"]).to eq(
            "stay" => { "listings" => 2, "businesses" => 1 }, "transfer" => { "listings" => 0, "businesses" => 0 },
            "rental" => { "listings" => 1, "businesses" => 1 }, "activity" => { "listings" => 3, "businesses" => 2 },
            "gear" => { "listings" => 0, "businesses" => 0 }
          )
          # The upper middle of the priced ones, in the unit most of them use; Island hopping has no price.
          expect(json["typical_prices"]).to eq([
            { "group" => "stay", "price_cents" => 300_000, "unit" => "night" },
            { "group" => "activity", "price_cents" => 150_000, "unit" => "person" }
          ])
          expect(json["visitor_rows"].pluck("id")).to eq([ hopping.id ])
          expect(json["visitor_rows"].first).to include("title" => "Island hopping")
        end
      end

      response "200", "what the plan's places step reads: must see, boat pins and the port" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }
        before do
          kota.update!(must_see: true)
          virgin.update!(boat_departure: "POINT(123.8 11.15)")
          bantayan.update!(port_name: "Santa Fe port", port_location: "POINT(123.8 11.16)")
        end

        run_test! do |response|
          json = response.parsed_body
          landmarks = json["landmarks"].index_by { _1["slug"] }
          expect(landmarks["kota-beach"]).to include("must_see" => true, "boat_departure" => nil)
          expect(landmarks["virgin-island"]).to include("must_see" => false, "boat_departure" => { "lat" => 11.15, "lng" => 123.8 })
          expect(json["port"]).to eq("name" => "Santa Fe port", "location" => { "lat" => 11.16, "lng" => 123.8 })
        end
      end

      response "200", "its photos and published landmarks" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }

        # Only ready photos, in the team's order (RAA-210).
        let!(:banner) { create_photo(bantayan, position: 2) }
        let!(:second) { create_photo(bantayan, position: 3) }
        let!(:kota_photo) { create_photo(kota) }

        before do
          create_photo(bantayan, position: 1, ready: false)
          create_photo(kota, uploaded: false)
        end

        run_test! do |response|
          json = response.parsed_body
          expect(json["area"]).to include("slug" => "bantayan-island", "parent_name" => "Cebu", "parent_slug" => "cebu")
          expect(json["photos"]).to eq([ banner, second ].map { ListingPhotoSerializer.call(it).stringify_keys })
          expect(json["photos"].first["card_url"]).to end_with("/test/area_photos/#{banner.id}/image_card.webp")
          expect(json["areas"]).to be_empty
          expect(json["landmarks"].pluck("slug")).to eq(%w[kota-beach virgin-island])
          expect(json["landmarks"].pluck("photos")).to eq([ [ ListingPhotoSerializer.call(kota_photo).stringify_keys ], [] ])
          expect(json["landmarks"].first).to include("description" => "Sandbar beach", "visited_by" => [])
          expect(json["landmarks"].first["tags"].pluck("slug")).to eq(%w[swimming white-sand])
        end
      end

      response "200", "the places to see in the places inside it, however deep (RAA-285)" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }
        let!(:santa_fe) { create(:area, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan) }
        let!(:port) { create(:area, slug: "santa-fe-port", name: "Santa Fe Port", parent: santa_fe) }
        let!(:hidden) { create(:area, :draft, slug: "madridejos", name: "Madridejos", kind: "town", parent: bantayan) }

        before do
          create(:landmark, area: santa_fe, slug: "ogtong-cave", name: "Ogtong Cave")
          create(:landmark, area: port, slug: "port-pier", name: "Port Pier")
          create(:landmark, :draft, area: santa_fe, slug: "draft-lagoon", name: "Draft Lagoon")
          create(:landmark, area: hidden, slug: "draft-town-beach", name: "Draft Town Beach")
        end

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("slug")).to eq(%w[kota-beach ogtong-cave port-pier virgin-island])
        end
      end

      response "200", "a place inside an island keeps to its own places to see" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "santa-fe" }
        let!(:santa_fe) { create(:area, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan) }

        before { create(:landmark, area: santa_fe, slug: "ogtong-cave", name: "Ogtong Cave") }

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("slug")).to eq(%w[ogtong-cave])
        end
      end

      response "200", "each place inside it counts its stays and what to book, the places under it included (RAA-252)" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }
        let!(:santa_fe) { create(:area, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan, center: "POINT(123.80123456 11.16)") }
        let!(:beach) { create(:area, slug: "sugar-beach", name: "Sugar Beach", parent: santa_fe) }
        let!(:madridejos) { create(:area, slug: "madridejos", name: "Madridejos", kind: "town", parent: bantayan) }
        let(:inn) { create(:business, name: "Santa Fe Inn") }

        before do
          guesthouse = create(:category, :accommodation)
          create(:listing, area: santa_fe, category: guesthouse, title: "Garden room A", partner: inn.partner, business: inn)
          create(:listing, area: beach, category: guesthouse, title: "Garden room B", partner: inn.partner, business: inn)
          create(:listing, :paused, area: beach, category: guesthouse, title: "Paused garden room")
          create(:listing, area: beach, category: tour, title: "Kayaks at the beach")
          create(:listing, area: madridejos, category: tour, title: "Market walk")
        end

        run_test! do |response|
          places = response.parsed_body["areas"].index_by { _1["slug"] }
          expect(places.keys).to eq(%w[madridejos santa-fe])
          expect(places["santa-fe"]).to include("stay_count" => 2, "to_book_count" => 2, "center" => { "lat" => 11.16, "lng" => 123.80123 })
          expect(places["madridejos"]).to include("stay_count" => 0, "to_book_count" => 1)
        end
      end

      response "200", "its guide, and where each place to see is (RAA-252)" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "bantayan-island" }

        before do
          bantayan.update!(tagline: "White sand, slow days", description: "A flat island north of Cebu.", getting_there: " ",
            best_time_to_visit: "December to May")
          kota.update!(location: "POINT(123.72345678 11.21)")
        end

        run_test! do |response|
          json = response.parsed_body
          expect(json["guide"]).to eq("tagline" => "White sand, slow days", "description" => "A flat island north of Cebu.",
            "getting_there" => nil, "best_time_to_visit" => "December to May")
          expect(json["landmarks"].first).to include("slug" => "kota-beach", "location" => { "lat" => 11.21, "lng" => 123.72346 })
        end
      end

      response "200", "an area with no guide written sends it empty" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "cebu-city" }

        run_test! do |response|
          expect(response.parsed_body["guide"]).to eq("tagline" => nil, "description" => nil, "getting_there" => nil, "best_time_to_visit" => nil)
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
          # Named too, for What to book's map.
          expect(landmarks["virgin-island"]["visits"]).to eq([ { "id" => hopping.id, "title" => "Island hopping", "category" => "Tour" } ])
          expect(landmarks["kota-beach"]["visits"]).to eq([])
        end
      end

      response "200", "a province lists the areas under it that have something to book, and the places to see in them" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "cebu" }
        let!(:mactan) { create(:area, slug: "mactan", name: "Mactan", parent: cebu) }

        run_test! do |response|
          json = response.parsed_body
          expect(json["areas"].pluck("slug")).to eq(%w[bantayan-island cebu-city])
          expect(json["landmarks"].pluck("slug")).to eq(%w[fort-san-pedro kota-beach virgin-island])
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
