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
  let!(:scooter) { create(:category, slug: "motorcycle", name: "Motorcycle") }
  let!(:hopping) { create(:listing, area: bantayan, category: tour, title: "Island hopping") }
  let!(:honda) { create(:listing, area: bantayan, category: scooter, title: "Honda Click 125") }
  let!(:pending) { create(:listing, :pending, area: bantayan, category: scooter, title: "Pending scooter") }
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
          expect(json["area"]).to include("slug" => "bantayan-island", "parent_name" => "Cebu")
          expect(json["areas"]).to be_empty
          expect(json["landmarks"].pluck("slug")).to eq(%w[kota-beach virgin-island])
          expect(json["landmarks"].first).to include("description" => "Sandbar beach")
          expect(json["landmarks"].first["tags"].pluck("slug")).to eq(%w[swimming white-sand])
          expect(json["listings"]).to contain_exactly(
            { "id" => hopping.id, "title" => "Island hopping", "category" => "Tour", "area_slug" => "bantayan-island",
              "booking_type" => "activity" },
            { "id" => honda.id, "title" => "Honda Click 125", "category" => "Motorcycle",
              "area_slug" => "bantayan-island", "booking_type" => "rental" }
          )
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
