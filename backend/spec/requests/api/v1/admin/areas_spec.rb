require "swagger_helper"

RSpec.describe "Admin areas", type: :request do
  let(:user) { create(:user, :admin) }
  let(:Authorization) { bearer_for(user) }
  let!(:cebu) { create(:area, slug: "cebu", name: "Cebu", kind: "province") }
  let!(:bantayan) { create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island", parent: cebu, aliases: [ "Bantayan" ]) }

  path "/api/v1/admin/areas" do
    get "List and search destinations" do
      tags "Admin"
      produces "application/json"
      description "Admin-only (RAA-164). Every area, drafts included: published first, then by name, " \
        "#{Api::V1::Admin::AreasController::PER_PAGE} a page. `q` matches the name, slug or an alias."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :q, in: :query, required: false, schema: { type: :string }
      parameter name: :status, in: :query, required: false, schema: { type: :string, enum: Area::STATUSES }
      parameter name: :kind, in: :query, required: false, schema: { type: :string, enum: Area::KINDS }
      parameter name: :page, in: :query, required: false, schema: { type: :integer, minimum: 1 }

      let!(:madridejos) { create(:area, :draft, slug: "madridejos", name: "Madridejos", parent: bantayan) }

      response "200", "every area, published first" do
        schema type: :object,
          properties: {
            areas: { type: :array, items: { "$ref" => "#/components/schemas/admin_area_row" } },
            total: { type: :integer }
          },
          required: %w[areas total]

        before { create(:listing, area: bantayan, status: "active") }

        run_test! do |response|
          body = response.parsed_body
          expect(body["total"]).to eq(3)
          expect(body["areas"].pluck("slug")).to eq(%w[bantayan-island cebu madridejos])
          expect(body["areas"].first).to include(
            "status" => "published", "parent" => { "slug" => "cebu", "name" => "Cebu" }, "listing_count" => 1
          )
        end
      end

      response "200", "searched by alias, with a filter" do
        schema type: :object, properties: { areas: { type: :array }, total: { type: :integer } }

        let(:q) { "bantay" }
        let(:status) { "published" }

        run_test! do |response|
          expect(response.parsed_body["areas"].pluck("slug")).to eq(%w[bantayan-island])
        end
      end

      response "422", "an unknown status" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:status) { "live" }

        run_test!
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

    post "Add a destination" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only (RAA-164). Adds an area as a draft unless `status` says otherwise."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/admin_area_body" }

      let!(:snorkelling) { create(:tag, slug: "snorkelling", name: "Snorkelling") }
      let(:body) do
        {
          name: "Virgin Island", slug: "virgin-island", kind: "island", parent_slug: "bantayan-island",
          center: { lat: 11.17, lng: 123.75 }, aliases: [ "Silion" ], tagline: "A sandbar off Santa Fe",
          tag_slugs: [ "snorkelling" ]
        }
      end

      response "201", "a new draft" do
        schema "$ref" => "#/components/schemas/admin_area"

        run_test! do |response|
          expect(response.parsed_body).to include(
            "slug" => "virgin-island", "status" => "draft", "parent" => { "slug" => "bantayan-island", "name" => "Bantayan Island" },
            "center" => { "lat" => 11.17, "lng" => 123.75 }, "aliases" => [ "Silion" ], "tagline" => "A sandbar off Santa Fe",
            "tags" => [ { "slug" => "snorkelling", "name" => "Snorkelling", "kind" => "activity" } ],
            "photos" => [], "banner_photo" => nil, "has_boundary" => false
          )
          expect(Area.find_by!(slug: "virgin-island").tags).to eq([ snorkelling ])
        end
      end

      response "422", "missing and wrong values" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) do
          { name: " ", slug: "virgin-island", kind: "island", center: { lat: 91, lng: "123" }, aliases: "Silion",
            tag_slugs: [ "nope" ], parent_slug: "nowhere" }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "Name is required", "Latitude must be a number between -90 and 90",
            "Longitude must be a number between -180 and 180", "Aliases must be a list of text",
            "Tags must be existing tag slugs", "Parent must be an existing area"
          )
        end
      end

      response "422", "a reserved slug and a long tagline" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { super().merge(slug: "admin", kind: "village", tagline: "x" * 121) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "Slug is reserved", "Kind is not included in the list", "Tagline is too long (maximum is 120 characters)"
          )
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user, :partner) }

        run_test!
      end
    end
  end

  path "/api/v1/admin/areas/{slug}" do
    parameter name: :slug, in: :path, schema: { type: :string }
    let(:slug) { "bantayan-island" }

    get "One destination" do
      tags "Admin"
      produces "application/json"
      description "Admin-only (RAA-164). Drafts included."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "200", "the area" do
        schema "$ref" => "#/components/schemas/admin_area"

        before do
          bantayan.update!(wikidata_id: "Q806973", wikidata_aliases: [ "Pulo sa Bantayan" ], wikidata_popularity: 23)
          create_photo(bantayan)
          create_photo(bantayan, uploaded: false)
        end

        run_test! do |response|
          body = response.parsed_body
          expect(body).to include("wikidata_id" => "Q806973", "wikidata_aliases" => [ "Pulo sa Bantayan" ], "wikidata_popularity" => 23)
          first, second = bantayan.photos
          expect(body["photos"].pluck("id", "uploaded", "ready")).to eq([ [ first.id, true, true ], [ second.id, false, false ] ])
          expect(body["photos"].first["card_url"]).to include("/test/area_photos/#{first.id}/image_card.jpg")
        end
      end

      response "404", "no such area" do
        schema "$ref" => "#/components/schemas/error"

        let(:slug) { "nowhere" }

        run_test!
      end
    end

    patch "Change a destination" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only (RAA-164). Fields left out are kept."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/admin_area_body" }

      let(:body) { { tagline: "White sand, slow days", getting_there: "Ferry from Hagnaya", best_time_to_visit: "March to June" } }

      response "200", "the details changed, the rest kept" do
        schema "$ref" => "#/components/schemas/admin_area"

        run_test! do |response|
          expect(response.parsed_body).to include("tagline" => "White sand, slow days", "aliases" => [ "Bantayan" ],
            "parent" => { "slug" => "cebu", "name" => "Cebu" })
          expect(bantayan.reload.getting_there).to eq("Ferry from Hagnaya")
        end
      end

      response "200", "published with every area above it" do
        schema "$ref" => "#/components/schemas/admin_area"

        let(:slug) { "madridejos" }
        let(:body) { { status: "published" } }

        before do
          cebu.update!(status: "draft")
          bantayan.update!(status: "draft")
          create(:area, :draft, slug: "madridejos", name: "Madridejos", parent: bantayan)
        end

        run_test! do
          expect([ cebu, bantayan ].map { it.reload.status }).to eq(%w[published published])
        end
      end

      response "200", "a new Wikidata item clears what came from the old one" do
        schema "$ref" => "#/components/schemas/admin_area"

        let(:body) { { wikidata_id: "Q806973" } }

        before { bantayan.update!(wikidata_id: "Q1", wikidata_aliases: [ "Old" ], wikidata_popularity: 9) }

        run_test! do |response|
          expect(response.parsed_body).to include("wikidata_id" => "Q806973", "wikidata_aliases" => [], "wikidata_popularity" => 0)
        end
      end

      response "422", "back to draft with an active listing" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { status: "draft" } }

        before { create(:listing, area: bantayan, status: "active") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Status can't go back to draft while it has active listings or published areas inside it" ])
          expect(bantayan.reload).to be_published
        end
      end

      response "422", "under an area inside it" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:slug) { "cebu" }
        let(:body) { { parent_slug: "bantayan-island" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Parent can't be this area or one inside it" ])
        end
      end

      response "422", "a Wikidata id another area has" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { wikidata_id: "Q806973", psgc_code: "123" } }

        before { cebu.update!(wikidata_id: "Q806973") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly("Wikidata has already been taken", "Psgc code must be 10 digits")
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user, :partner) }

        run_test! { expect(bantayan.reload.tagline).to eq("") }
      end
    end
  end

  path "/api/v1/admin/areas/{slug}/seed" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :slug, in: :path, schema: { type: :string }

    post "Seed a destination from Wikidata" do
      tags "Admin"
      produces "application/json"
      description "Admin-only (RAA-168). Makes the area a destination in the background: publishes it and every " \
        "area above it, adds Wikidata's landmarks inside its boundary as drafts, and gives it and its landmarks " \
        "Wikidata's search terms and popularity. Poll the area until `seed_status` is `done` or `failed`; the " \
        "new drafts are in `GET /api/v1/admin/landmarks?area=<slug>&status=draft`. Safe to run again; 409 while " \
        "a run is queued or running."
      security [ { bearer: [] } ]

      let(:slug) { "bantayan-island" }

      response "202", "the run is queued" do
        schema "$ref" => "#/components/schemas/admin_area"

        run_test! do |response|
          expect(response.parsed_body).to include("slug" => "bantayan-island", "seed_status" => "queued",
            "seed_report" => { "landmarks_added" => nil, "enriched" => nil, "skipped" => [], "error" => nil })
          expect(Gazetteer::SeedAreaJob).to have_been_enqueued.with(bantayan)
        end
      end

      response "409", "a run is already under way" do
        schema "$ref" => "#/components/schemas/error"

        before { bantayan.update!(seed_status: "running") }

        run_test! do
          expect(Gazetteer::SeedAreaJob).not_to have_been_enqueued
        end
      end

      response "404", "no such area" do
        schema "$ref" => "#/components/schemas/error"
        let(:slug) { "nowhere" }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

        run_test! do
          expect(bantayan.reload.seed_status).to eq("idle")
        end
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/admin/area_options" do
    get "What a destination can be" do
      tags "Admin"
      produces "application/json"
      description "Admin-only (RAA-164). The kinds and the tags a destination's form offers."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "200", "kinds and tags" do
        schema "$ref" => "#/components/schemas/admin_area_options"

        before { create(:tag, slug: "diving", name: "Diving") }

        run_test! do |response|
          expect(response.parsed_body).to eq("kinds" => Area::KINDS,
            "tags" => [ { "slug" => "diving", "name" => "Diving", "kind" => "activity" } ])
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user, :partner) }

        run_test!
      end
    end
  end
end
