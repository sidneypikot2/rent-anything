require "swagger_helper"

RSpec.describe "Admin link suggestions", type: :request do
  path "/api/v1/admin/link_suggestions" do
    get "Destination links suggested by search picks" do
      tags "Admin"
      produces "application/json"
      description "Admin-only. Pairs of published areas and landmarks that guests picked in the same visit, in at " \
        "least #{DestinationLinks::Suggestions::MIN_SESSIONS} visits over the last 90 days, most visits first, at " \
        "most 50. Pairs already linked are left out. Approve one with `POST /api/v1/admin/destination_links`."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :admin) }
      let(:Authorization) { bearer_for(user) }

      response "200", "pairs picked together often enough, not yet linked" do
        schema type: :array, items: { "$ref" => "#/components/schemas/link_suggestion" }

        let(:moalboal) { create(:area, slug: "moalboal", name: "Moalboal") }
        let(:badian) { create(:area, slug: "badian", name: "Badian") }
        let(:bantayan) { create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island") }
        let(:malapascua) { create(:area, slug: "malapascua", name: "Malapascua", kind: "island") }
        let(:kawasan) { create(:landmark, area: badian, slug: "kawasan-falls", name: "Kawasan Falls") }
        let(:snorkelling) { create(:tag, slug: "snorkelling") }

        def visit(session, *targets)
          targets.each { |target| create(:search_event, session_hash: format("%064x", session), target:) }
        end

        before do
          (1..3).each { |session| visit(session, kawasan, moalboal, moalboal) }
          (4..5).each { |session| visit(session, bantayan, malapascua) }
          (6..8).each { |session| visit(session, moalboal, badian, snorkelling) }
          create(:destination_link, source: moalboal, target: badian)
          create(:search_event, session_hash: format("%064x", 9), target: kawasan, created_at: 91.days.ago)
          create(:search_event, session_hash: format("%064x", 9), target: moalboal, created_at: 91.days.ago)
        end

        run_test! do |response|
          expect(response.parsed_body).to eq([
            {
              "source" => { "type" => "area", "slug" => "moalboal", "name" => "Moalboal" },
              "target" => { "type" => "landmark", "slug" => "kawasan-falls", "name" => "Kawasan Falls" },
              "sessions" => 3
            }
          ])
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

        run_test!
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
