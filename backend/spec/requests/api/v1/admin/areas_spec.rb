require "swagger_helper"

RSpec.describe "Admin areas", type: :request do
  let(:user) { create(:user, :admin) }
  let(:Authorization) { bearer_for(user) }
  let!(:cebu) { create(:area, slug: "cebu", name: "Cebu", kind: "province") }
  let!(:moalboal) { create(:area, :draft, slug: "moalboal", name: "Moalboal", parent: cebu) }
  let!(:badian) { create(:area, :draft, slug: "badian", name: "Badian", parent: cebu) }

  path "/api/v1/admin/areas" do
    parameter name: :Authorization, in: :header, schema: { type: :string }

    get "Find areas to seed" do
      tags "Admin"
      produces "application/json"
      description "Admin-only (RAA-168). Gazetteer areas by name, at most 100: `q` matches the name or slug, " \
        "`kind` and `status` narrow it. Each comes with its landmark counts and its last seeding run."
      security [ { bearer: [] } ]
      parameter name: :q, in: :query, required: false, schema: { type: :string }
      parameter name: :kind, in: :query, required: false, schema: { type: :string, enum: Area::KINDS }
      parameter name: :status, in: :query, required: false, schema: { type: :string, enum: Area::STATUSES }

      let(:q) { nil }
      let(:kind) { nil }
      let(:status) { nil }

      response "200", "the matching areas, by name" do
        schema type: :array, items: { "$ref" => "#/components/schemas/admin_area" }
        let(:q) { "BOAL" }

        before do
          create(:landmark, area: moalboal)
          create(:landmark, :draft, area: moalboal)
          create(:landmark, :draft, area: moalboal)
        end

        run_test! do |response|
          expect(response.parsed_body).to eq([ {
            "id" => moalboal.id, "slug" => "moalboal", "name" => "Moalboal", "kind" => "town", "status" => "draft",
            "parent_name" => "Cebu", "landmarks_published" => 1, "landmarks_draft" => 2, "wikidata_id" => nil,
            "seed_status" => "idle", "seeded_at" => nil,
            "seed_report" => { "landmarks_added" => nil, "enriched" => nil, "skipped" => [], "error" => nil }
          } ])
        end
      end

      response "200", "filtered by kind and status" do
        schema type: :array, items: { "$ref" => "#/components/schemas/admin_area" }
        let(:kind) { "town" }
        let(:status) { "draft" }

        run_test! do |response|
          expect(response.parsed_body.pluck("slug")).to eq(%w[badian moalboal])
        end
      end

      response "422", "an unknown kind" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:kind) { "barangay" }

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
  end

  path "/api/v1/admin/areas/{id}/seed" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :id, in: :path, schema: { type: :integer }

    post "Seed an area" do
      tags "Admin"
      produces "application/json"
      description "Admin-only (RAA-168). Makes the area a destination in the background: publishes it and every " \
        "area above it, adds Wikidata's landmarks inside its boundary as drafts, and gives it and its landmarks " \
        "Wikidata's search terms and popularity. Poll `GET /api/v1/admin/areas` until `seed_status` is `done` or " \
        "`failed`. Safe to run again; 409 while a run is queued or running."
      security [ { bearer: [] } ]

      let(:id) { moalboal.id }

      response "202", "the run is queued" do
        schema "$ref" => "#/components/schemas/admin_area"

        run_test! do |response|
          expect(response.parsed_body).to include("slug" => "moalboal", "seed_status" => "queued")
          expect(Gazetteer::SeedAreaJob).to have_been_enqueued.with(moalboal)
        end
      end

      response "409", "a run is already under way" do
        schema "$ref" => "#/components/schemas/error"

        before { moalboal.update!(seed_status: "running") }

        run_test! do
          expect(Gazetteer::SeedAreaJob).not_to have_been_enqueued
        end
      end

      response "404", "no such area" do
        schema "$ref" => "#/components/schemas/error"
        let(:id) { 0 }

        run_test!
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test! do
          expect(moalboal.reload.seed_status).to eq("idle")
        end
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/admin/areas/{id}/landmarks" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :id, in: :path, schema: { type: :integer }

    get "An area's landmarks" do
      tags "Admin"
      produces "application/json"
      description "Admin-only (RAA-168). Every landmark of the area, drafts too, by name: what a seeding run " \
        "found, to publish or leave out."
      security [ { bearer: [] } ]

      let(:id) { moalboal.id }

      response "200", "the landmarks, by name" do
        schema type: :array, items: { "$ref" => "#/components/schemas/admin_landmark" }

        before do
          create(:landmark, slug: "white-beach", name: "White Beach", area: moalboal, location: "POINT(123.37 9.96)")
          create(:landmark, :draft, slug: "pescador", name: "Pescador Island", area: moalboal, wikidata_id: "Q2223260")
        end

        run_test! do |response|
          expect(response.parsed_body).to eq([
            { "id" => Landmark.find_by!(slug: "pescador").id, "slug" => "pescador", "name" => "Pescador Island",
              "status" => "draft", "wikidata_id" => "Q2223260", "lng" => 123.344, "lat" => 9.926 },
            { "id" => Landmark.find_by!(slug: "white-beach").id, "slug" => "white-beach", "name" => "White Beach",
              "status" => "published", "wikidata_id" => nil, "lng" => 123.37, "lat" => 9.96 }
          ])
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
