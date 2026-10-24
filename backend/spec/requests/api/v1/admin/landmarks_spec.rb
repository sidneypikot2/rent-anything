require "swagger_helper"

RSpec.describe "Admin landmarks", type: :request do
  let(:user) { create(:user, :admin) }
  let(:Authorization) { bearer_for(user) }
  let!(:bantayan) { create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island", center: "POINT(123.72 11.17)") }
  let!(:santa_fe) { create(:area, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan, center: "POINT(123.80 11.16)") }
  let!(:kota) { create(:landmark, area: santa_fe, slug: "kota-beach", name: "Kota Beach", aliases: [ "Kota" ], location: "POINT(123.80 11.15)") }

  path "/api/v1/admin/landmarks" do
    get "List and search landmarks" do
      tags "Admin"
      produces "application/json"
      description "Admin-only. Every landmark (place to see), drafts included: published first, then by name, " \
        "#{Api::V1::Admin::LandmarksController::PER_PAGE} a page. `q` matches the name, slug or an alias; `area` " \
        "keeps the landmarks in that area or any area inside it."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :q, in: :query, required: false, schema: { type: :string }
      parameter name: :status, in: :query, required: false, schema: { type: :string, enum: Landmark::STATUSES }
      parameter name: :area, in: :query, required: false, schema: { type: :string }
      parameter name: :page, in: :query, required: false, schema: { type: :integer, minimum: 1 }

      let!(:ogtong) { create(:landmark, :draft, area: santa_fe, slug: "ogtong-cave", name: "Ogtong Cave") }
      let!(:kawasan) { create(:landmark, slug: "kawasan-falls", name: "Kawasan Falls") }

      response "200", "every landmark, published first" do
        schema type: :object,
          properties: {
            landmarks: { type: :array, items: { "$ref" => "#/components/schemas/admin_landmark_row" } },
            total: { type: :integer }
          },
          required: %w[landmarks total]

        before { create(:listing, :tour).landmarks << kota }

        run_test! do |response|
          body = response.parsed_body
          expect(body["total"]).to eq(3)
          expect(body["landmarks"].pluck("slug")).to eq(%w[kawasan-falls kota-beach ogtong-cave])
          expect(body["landmarks"].second).to include(
            "status" => "published", "area" => { "slug" => "santa-fe", "name" => "Santa Fe" }, "visit_count" => 1
          )
        end
      end

      response "200", "searched by alias inside an area" do
        schema type: :object, properties: { landmarks: { type: :array }, total: { type: :integer } }

        let(:q) { "kot" }
        let(:area) { "bantayan-island" }

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("slug")).to eq(%w[kota-beach])
        end
      end

      response "422", "an unknown status and area" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:status) { "live" }
        let(:area) { "nowhere" }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "Status must be one of draft, published", "Area must be an existing area"
          )
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user, :partner) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end

    post "Add a landmark" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only. Adds a landmark as a draft unless `status` says otherwise. Its area is the one " \
        "listings at that pin would be in: the smallest published city, town or island whose boundary covers it, " \
        "else the nearest one."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/admin_landmark_body" }

      let!(:snorkelling) { create(:tag, slug: "snorkelling", name: "Snorkelling") }
      let(:body) do
        {
          name: "Virgin Island", slug: "virgin-island", location: { lat: 11.17, lng: 123.79 },
          description: "A sandbar off Santa Fe", aliases: [ "Silion", " silion " ], tag_slugs: [ "snorkelling" ]
        }
      end

      response "201", "a new draft in the area serving the pin" do
        schema "$ref" => "#/components/schemas/admin_landmark"

        run_test! do |response|
          expect(response.parsed_body).to include(
            "slug" => "virgin-island", "status" => "draft", "area" => { "slug" => "santa-fe", "name" => "Santa Fe" },
            "location" => { "lat" => 11.17, "lng" => 123.79 }, "aliases" => [ "Silion" ],
            "description" => "A sandbar off Santa Fe",
            "tags" => [ { "slug" => "snorkelling", "name" => "Snorkelling", "kind" => "activity" } ], "visit_count" => 0
          )
          expect(Landmark.find_by!(slug: "virgin-island").tags).to eq([ snorkelling ])
        end
      end

      response "422", "missing and wrong values" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) do
          { name: " ", slug: "kota-beach", location: { lat: 91, lng: "123" }, aliases: "Silion", tag_slugs: [ "nope" ],
            status: "live", description: 3 }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "Name is required", "Latitude must be a number between -90 and 90",
            "Longitude must be a number between -180 and 180", "Aliases must be a list of text",
            "Tags must be existing tag slugs", "Status must be one of draft, published", "Description must be text"
          )
        end
      end

      response "422", "a taken slug" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { super().merge(slug: "kota-beach") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Slug has already been taken" ])
        end
      end

      response "422", "a pin no destination serves" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { super().merge(location: { lat: 14.6, lng: 121.0 }) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "No published destination near this pin yet" ])
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user, :partner) }

        run_test! { expect(Landmark.exists?(slug: "virgin-island")).to be(false) }
      end
    end
  end

  path "/api/v1/admin/landmarks/{slug}" do
    parameter name: :slug, in: :path, schema: { type: :string }
    let(:slug) { "kota-beach" }

    get "One landmark" do
      tags "Admin"
      produces "application/json"
      description "Admin-only. Drafts included."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "200", "the landmark" do
        schema "$ref" => "#/components/schemas/admin_landmark"

        before { kota.update!(wikidata_id: "Q123", wikidata_aliases: [ "Baybayon sa Kota" ], wikidata_popularity: 4) }

        run_test! do |response|
          expect(response.parsed_body).to include(
            "aliases" => [ "Kota" ], "wikidata_id" => "Q123", "wikidata_aliases" => [ "Baybayon sa Kota" ],
            "wikidata_popularity" => 4
          )
        end
      end

      response "404", "no such landmark" do
        schema "$ref" => "#/components/schemas/error"

        let(:slug) { "nowhere" }

        run_test!
      end
    end

    patch "Change a landmark" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only. Fields left out are kept. A new pin moves the landmark to the area serving it."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/admin_landmark_body" }

      let!(:beach) { create(:tag, slug: "beach", name: "Beach", kind: "feature") }
      let(:body) { { status: "draft", description: "White sand", tag_slugs: [ "beach" ] } }

      response "200", "the details changed, the rest kept" do
        schema "$ref" => "#/components/schemas/admin_landmark"

        before { kota.tags << create(:tag, slug: "swimming", name: "Swimming") }

        run_test! do |response|
          expect(response.parsed_body).to include(
            "status" => "draft", "description" => "White sand", "aliases" => [ "Kota" ],
            "tags" => [ { "slug" => "beach", "name" => "Beach", "kind" => "feature" } ]
          )
          expect(kota.reload.tags).to eq([ beach ])
        end
      end

      response "200", "moved to the area serving its new pin" do
        schema "$ref" => "#/components/schemas/admin_landmark"

        let(:body) { { location: { lat: 11.17, lng: 123.72 } } }

        run_test! do |response|
          expect(response.parsed_body["area"]).to eq("slug" => "bantayan-island", "name" => "Bantayan Island")
        end
      end

      response "422", "an empty name" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { name: "" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Name is required" ])
          expect(kota.reload.name).to eq("Kota Beach")
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user, :partner) }

        run_test! { expect(kota.reload.description).to eq("") }
      end
    end
  end
end
