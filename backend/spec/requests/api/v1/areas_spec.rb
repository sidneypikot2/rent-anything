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
      attrs: { "make" => "Honda", "plate_no" => "BTN 4521", "engine_cc" => 125, "helmet_included" => true })
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
            "landmark_count" => 2, "listing_count" => 2,
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
          expect(json["landmarks"].first).to include("description" => "Sandbar beach")
          expect(json["landmarks"].first["tags"].pluck("slug")).to eq(%w[swimming white-sand])
          expect(json["listings"]).to contain_exactly(
            { "id" => hopping.id, "title" => "Island hopping", "category" => "Tour", "area_slug" => "bantayan-island",
              "cover_photo_url" => nil, "booking_type" => "activity", "summary" => "Four islands and a sandbar in one day.",
              "business" => { "name" => "Moalboal Gear Rentals" }, "units_count" => 1, "units_label" => "1 unit",
              "partner_name" => "Moalboal Gear Rentals", "price_from_cents" => nil, "price_unit" => nil,
              "photos" => [], "details" => {}, "cancellation_policy" => "free_cancellation" },
            { "id" => honda.id, "title" => "Honda Click 125", "category" => "Motorcycle",
              "area_slug" => "bantayan-island", "cover_photo_url" => nil, "booking_type" => "rental", "summary" => "",
              "business" => { "name" => "Basilia Motor Rentals" }, "units_count" => 50, "units_label" => "50 motorcycles",
              "partner_name" => "Basilia Motor Rentals", "price_from_cents" => nil, "price_unit" => nil,
              "photos" => [], "details" => { "engine_cc" => 125, "helmet_included" => true }, "cancellation_policy" => "free_cancellation" }
          )
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

      response "200", "a province lists the areas under it that have something to book" do
        schema "$ref" => "#/components/schemas/area_detail"
        let(:slug) { "cebu" }
        let!(:mactan) { create(:area, slug: "mactan", name: "Mactan", parent: cebu) }

        run_test! do |response|
          json = response.parsed_body
          expect(json["areas"].pluck("slug")).to eq(%w[bantayan-island cebu-city])
          expect(json["landmarks"]).to be_empty
          expect(json["listings"]).to be_empty
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
end
