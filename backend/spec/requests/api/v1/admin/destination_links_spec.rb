require "swagger_helper"

RSpec.describe "Admin destination links", type: :request do
  let!(:moalboal) { create(:area, slug: "moalboal", name: "Moalboal") }
  let!(:kawasan) { create(:landmark, slug: "kawasan-falls", name: "Kawasan Falls") }
  let(:valid_body) do
    { source: { type: "landmark", slug: "kawasan-falls" }, target: { type: "area", slug: "moalboal" }, kind: "bundled", weight: 2 }
  end

  path "/api/v1/admin/destination_links" do
    post "Link two destinations" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only. Links two areas or landmarks, usually from `GET /api/v1/admin/link_suggestions`. " \
        "Explore then recommends each from the other. The order of the two ends doesn't matter, and a pair can " \
        "only be linked once. `weight` (1 to 3, default 1) orders recommendations."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          source: { "$ref" => "#/components/schemas/place_key" },
          target: { "$ref" => "#/components/schemas/place_key" },
          kind: { type: :string, enum: DestinationLink::KINDS },
          weight: { type: :integer, minimum: 1, maximum: 3 }
        },
        required: %w[source target kind]
      }

      let(:user) { create(:user, :admin) }
      let(:Authorization) { bearer_for(user) }

      response "201", "the link is created" do
        schema "$ref" => "#/components/schemas/destination_link"
        let(:body) { valid_body }

        run_test! do |response|
          expect(response.parsed_body).to eq(
            "source" => { "type" => "area", "slug" => "moalboal", "name" => "Moalboal" },
            "target" => { "type" => "landmark", "slug" => "kawasan-falls", "name" => "Kawasan Falls" },
            "kind" => "bundled", "weight" => 2
          )
          expect(DestinationLink.for(moalboal).sole.other(moalboal)).to eq(kawasan)
        end
      end

      response "422", "a pair that is already linked" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { valid_body }

        before { create(:destination_link, source: moalboal, target: kawasan) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Target is already linked" ])
        end
      end

      response "422", "a wrong kind, weight and end type" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { valid_body.merge(source: { type: "tag", slug: "snorkelling" }, kind: "nearby", weight: "2") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "Source type must be one of area, landmark", "Kind must be one of bundled, adjacent",
            "Weight must be a whole number from 1 to 3"
          )
        end
      end

      response "404", "no such place" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { valid_body.merge(target: { type: "area", slug: "nowhere" }) }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }
        let(:body) { valid_body }

        run_test! do
          expect(DestinationLink.count).to eq(0)
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }
        let(:body) { valid_body }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }
        let(:body) { valid_body }

        run_test!
      end
    end
  end
end
