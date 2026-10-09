require "swagger_helper"

RSpec.describe "Search", type: :request do
  let!(:cebu) { create(:area, slug: "cebu", name: "Cebu", kind: "province") }
  let!(:bantayan) { create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island", parent: cebu, aliases: [ "Bantayan" ]) }
  let!(:cebu_city) { create(:area, slug: "cebu-city", name: "Cebu City", kind: "city", parent: cebu) }
  let!(:empty_area) { create(:area, slug: "oslob", name: "Oslob") }

  let!(:snorkelling) { create(:tag, slug: "snorkelling", name: "Snorkelling", aliases: [ "snorkeling" ]) }
  let!(:history) { create(:tag, slug: "history", name: "History", kind: "theme") }

  let!(:virgin_island) { create(:landmark, area: bantayan, slug: "virgin-island", name: "Virgin Island", tags: [ snorkelling ]) }
  let!(:hilantagaan) { create(:landmark, area: bantayan, slug: "hilantagaan-island", name: "Hilantagaan Island", tags: [ snorkelling ]) }
  let!(:fort) { create(:landmark, area: cebu_city, slug: "fort-san-pedro", name: "Fort San Pedro", tags: [ history ]) }
  let!(:basilica) { create(:landmark, area: cebu_city, slug: "basilica-santo-nino", name: "Basilica Minore del Santo Niño") }
  let!(:city_reef) { create(:landmark, area: cebu_city, slug: "city-reef", name: "City Reef", tags: [ snorkelling ]) }
  let!(:draft_beach) { create(:landmark, :draft, area: bantayan, slug: "kota-beach", name: "Kota Beach") }
  let!(:oslob_reef) { create(:landmark, area: empty_area, slug: "oslob-reef", name: "Oslob Reef", tags: [ snorkelling ]) }

  let!(:camera) { create(:category, slug: "action-camera", name: "Action camera") }
  let!(:gopro) { create(:listing, area: bantayan, category: camera, title: "GoPro Hero 12 with dive housing") }
  let!(:city_gopro) { create(:listing, area: cebu_city, category: camera, title: "Sony mirrorless camera") }
  let!(:pending_gopro) { create(:listing, :pending, area: cebu_city, category: camera, title: "GoPro Hero 11") }

  # Areas, landmarks and tags are searched through the search_terms view (RAA-60).
  before { SearchTerm.refresh }

  path "/api/v1/search" do
    get "Search destinations, landmarks, tags and listings" do
      tags "Discovery"
      produces "application/json"
      description "One search box over areas, published landmarks, tags (activities, features, themes) and active listings. " \
        "Accent- and typo-tolerant, and matches each record's aliases. At most 5 results per group. " \
        "Areas without anything to book are left out, and listings carry no location."
      parameter name: :q, in: :query, type: :string, required: true, description: "At least 2 characters"

      response "200", "results grouped by kind" do
        schema "$ref" => "#/components/schemas/search_results"
        let(:q) { "island" }

        run_test! do |response|
          json = response.parsed_body
          expect(json["areas"].pluck("slug")).to eq([ "bantayan-island" ])
          expect(json["areas"].first).to include("parent_name" => "Cebu", "kind" => "island")
          expect(json["landmarks"].pluck("slug")).to contain_exactly("virgin-island", "hilantagaan-island")
          expect(json["landmarks"].first["area"]).to eq("slug" => "bantayan-island", "name" => "Bantayan Island")
        end
      end

      response "200", "a parent area shows when an area under it has listings" do
        schema "$ref" => "#/components/schemas/search_results"
        let(:q) { "cebu" }

        run_test! do |response|
          expect(response.parsed_body["areas"].pluck("slug")).to eq(%w[cebu cebu-city])
        end
      end

      response "200", "an activity lists its areas, most matching landmarks first" do
        schema "$ref" => "#/components/schemas/search_results"
        let(:q) { "snork" }

        run_test! do |response|
          activity = response.parsed_body["tags"].sole
          expect(activity).to include("slug" => "snorkelling", "name" => "Snorkelling", "kind" => "activity")
          # Oslob has a snorkelling landmark but nothing to book.
          expect(activity["areas"]).to eq([
            { "slug" => "bantayan-island", "name" => "Bantayan Island", "landmark_count" => 2 },
            { "slug" => "cebu-city", "name" => "Cebu City", "landmark_count" => 1 }
          ])
        end
      end

      response "200", "aliases match" do
        schema "$ref" => "#/components/schemas/search_results"
        let(:q) { "snorkeling" }

        run_test! do |response|
          expect(response.parsed_body["tags"].pluck("slug")).to eq([ "snorkelling" ])
        end
      end

      response "200", "accents don't matter" do
        schema "$ref" => "#/components/schemas/search_results"
        let(:q) { "santo nino" }

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("slug")).to eq([ "basilica-santo-nino" ])
        end
      end

      response "200", "small typos still match" do
        schema "$ref" => "#/components/schemas/search_results"
        let(:q) { "fort sn pedro" }

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("slug")).to eq([ "fort-san-pedro" ])
        end
      end

      response "200", "active listings only, without their location" do
        schema "$ref" => "#/components/schemas/search_results"
        let(:q) { "gopro" }

        run_test! do |response|
          listings = response.parsed_body["listings"]
          expect(listings).to eq([
            { "id" => gopro.id, "title" => "GoPro Hero 12 with dive housing", "category" => "Action camera",
              "area_slug" => "bantayan-island" }
          ])
        end
      end

      response "200", "draft landmarks and areas with nothing to book stay hidden" do
        schema "$ref" => "#/components/schemas/search_results"
        let(:q) { "kota" }

        run_test! do |response|
          expect(response.parsed_body.values).to all(be_empty)
        end
      end

      response "200", "landmarks and tags in an area with nothing to book stay hidden" do
        schema "$ref" => "#/components/schemas/search_results"
        let(:q) { "oslob" }

        run_test! do |response|
          expect(response.parsed_body.values).to all(be_empty)
        end
      end

      response "200", "a tag only found in an area with nothing to book stays hidden" do
        schema "$ref" => "#/components/schemas/search_results"
        let!(:whale_watching) { create(:tag, slug: "whale-watching", name: "Whale watching", landmarks: [ oslob_reef ]) }
        let(:q) { "whale" }

        before { SearchTerm.refresh }

        run_test! do |response|
          expect(response.parsed_body["tags"]).to be_empty
        end
      end

      response "200", "exact name ranks first" do
        schema "$ref" => "#/components/schemas/search_results"
        let(:q) { "virgin island" }

        run_test! do |response|
          expect(response.parsed_body["landmarks"].first["slug"]).to eq("virgin-island")
        end
      end

      response "200", "popularity breaks a tie: the place guests pick more often comes first" do
        schema "$ref" => "#/components/schemas/search_results"
        let!(:island_lagoon) { create(:landmark, area: bantayan, slug: "lagoon-bantayan", name: "Blue Lagoon") }
        let!(:city_lagoon) { create(:landmark, area: cebu_city, slug: "lagoon-cebu-city", name: "Blue Lagoon") }
        let(:q) { "blue lagoon" }

        before do
          3.times { |n| create(:search_event, query_normalized: "blue lagoon", target: city_lagoon, session_hash: format("%064x", n)) }
          SearchTerm.refresh
        end

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("slug")).to eq(%w[lagoon-cebu-city lagoon-bantayan])
        end
      end

      response "422", "query too short" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:q) { "k" }

        run_test!
      end

      response "422", "query missing" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:q) { nil }

        run_test!
      end
    end
  end

  # rswag sends a list as one comma-joined string, so these go through plain requests.
  it "refuses a query given as a list" do
    get "/api/v1/search", params: { q: [ "kota", "beach" ] }

    expect(response).to have_http_status(:unprocessable_content)
  end

  it "refuses a query given as an object" do
    get "/api/v1/search", params: { q: { name: "kota" } }

    expect(response).to have_http_status(:unprocessable_content)
  end
end
