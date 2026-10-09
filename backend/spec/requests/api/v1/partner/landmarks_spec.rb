require "swagger_helper"

RSpec.describe "Partner landmarks", type: :request do
  path "/api/v1/partner/landmarks" do
    get "Landmarks a tour can visit" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Published landmarks for the tour landmark picker (RAA-70), at most 50: `q` " \
        "matches the name or an alias, `area` keeps the landmarks whose destination is that area, and `lat`/`lng` " \
        "(the listing's pin) ranks them nearest first; otherwise they're by name. Each landmark carries its " \
        "destination: the published island it's on, otherwise its town or city. `destinations` lists every " \
        "destination that has a published landmark, whatever the filters, for the picker's area chips."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :q, in: :query, required: false, schema: { type: :string }
      parameter name: :area, in: :query, required: false, schema: { type: :string }, description: "A destination's slug"
      parameter name: :lat, in: :query, required: false, schema: { type: :number }
      parameter name: :lng, in: :query, required: false, schema: { type: :number }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }
      let(:q) { nil }
      let(:area) { nil }
      let(:lat) { nil }
      let(:lng) { nil }

      let!(:cebu) { create(:area, slug: "cebu", name: "Cebu", kind: "province", center: "POINT(123.89 10.32)") }
      let!(:bantayan) do
        create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island", parent: cebu,
          center: "POINT(123.73 11.17)")
      end
      let!(:santa_fe) do
        create(:area, slug: "santa-fe", name: "Santa Fe", parent: bantayan, center: "POINT(123.80 11.16)")
      end
      let!(:badian) { create(:area, slug: "badian", name: "Badian", parent: cebu, center: "POINT(123.39 9.87)") }
      let!(:kota) do
        create(:landmark, slug: "kota-beach", name: "Kota Beach", area: santa_fe, location: "POINT(123.80 11.15)",
          aliases: [ "Kota Park" ])
      end
      let!(:virgin) do
        create(:landmark, slug: "virgin-island", name: "Virgin Island", area: bantayan,
          location: "POINT(123.83 11.11)")
      end
      let!(:kawasan) do
        create(:landmark, slug: "kawasan-falls", name: "Kawasan Falls", area: badian, location: "POINT(123.37 9.81)")
      end
      let!(:draft) { create(:landmark, :draft, slug: "secret-cove", name: "Secret Cove", area: santa_fe) }

      response "200", "every published landmark by name, each with its area and destination" do
        schema "$ref" => "#/components/schemas/partner_landmarks"

        run_test! do |response|
          landmarks = response.parsed_body["landmarks"]
          expect(landmarks.pluck("name")).to eq([ "Kawasan Falls", "Kota Beach", "Virgin Island" ])
          expect(landmarks.second).to eq(
            "id" => kota.id, "slug" => "kota-beach", "name" => "Kota Beach",
            "area" => { "slug" => "santa-fe", "name" => "Santa Fe" },
            "destination" => { "slug" => "bantayan-island", "name" => "Bantayan Island" },
            "location" => { "lat" => 11.15, "lng" => 123.80 }
          )
          expect(response.parsed_body["destinations"]).to eq([
            { "slug" => "badian", "name" => "Badian", "landmark_count" => 1 },
            { "slug" => "bantayan-island", "name" => "Bantayan Island", "landmark_count" => 2 }
          ])
        end
      end

      response "200", "matching the name or an alias, case-insensitively" do
        schema "$ref" => "#/components/schemas/partner_landmarks"
        let(:q) { "kota p" }

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("slug")).to eq([ "kota-beach" ])
          expect(response.parsed_body["destinations"].size).to eq(2)
        end
      end

      response "200", "only one destination's landmarks, its towns included" do
        schema "$ref" => "#/components/schemas/partner_landmarks"
        let(:area) { "bantayan-island" }

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("slug")).to eq([ "kota-beach", "virgin-island" ])
        end
      end

      response "200", "a destination that is a draft town still filters" do
        schema "$ref" => "#/components/schemas/partner_landmarks"
        let(:area) { "badian" }

        before { badian.update!(status: "draft") }

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("slug")).to eq([ "kawasan-falls" ])
        end
      end

      response "200", "nearest the listing's pin first" do
        schema "$ref" => "#/components/schemas/partner_landmarks"
        let(:lat) { 9.85 }
        let(:lng) { 123.40 }

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("slug")).to eq([ "kawasan-falls", "virgin-island", "kota-beach" ])
        end
      end

      response "422", "a pin that isn't a coordinate" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:lat) { "north" }
        let(:lng) { 123.40 }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Latitude must be a number between -90 and 90")
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
