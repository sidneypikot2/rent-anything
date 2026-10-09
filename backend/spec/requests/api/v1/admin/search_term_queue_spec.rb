require "swagger_helper"

RSpec.describe "Admin search term queue", type: :request do
  path "/api/v1/admin/search_term_queue" do
    get "Searches that need a search term" do
      tags "Admin"
      produces "application/json"
      description "Admin-only. Queries from the last 90 days that found nothing or whose results guests rarely " \
        "picked (under 1 in 5), most searched first, at most 50. A query that now matches a name or alias " \
        "exactly is left out. Add one as a search term with `POST /api/v1/admin/search_terms`."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :admin) }
      let(:Authorization) { bearer_for(user) }

      response "200", "unanswered and unpicked queries, most searched first" do
        schema type: :array, items: { "$ref" => "#/components/schemas/search_term_queue_entry" }

        let(:moalboal) { create(:area, slug: "moalboal", name: "Moalboal") }

        before do
          create_list(:search_event, 3, query_normalized: "kawasn", result_count: 0)
          create_list(:search_event, 2, query_normalized: "panagsama", result_count: 2)
          create_list(:search_event, 4, query_normalized: "moal", result_count: 1, target: moalboal)
          create(:search_event, query_normalized: "moal", result_count: 1)
          create_list(:search_event, 2, query_normalized: "moalboal", result_count: 0)
          create(:search_event, query_normalized: "old query", result_count: 0, created_at: 91.days.ago)
          SearchTerm.refresh
        end

        run_test! do |response|
          expect(response.parsed_body).to eq([
            { "query" => "kawasn", "searches" => 3, "picks" => 0, "zero_results" => 3 },
            { "query" => "panagsama", "searches" => 2, "picks" => 0, "zero_results" => 0 }
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
