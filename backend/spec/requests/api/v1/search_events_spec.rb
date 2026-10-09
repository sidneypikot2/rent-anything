require "swagger_helper"

RSpec.describe "Search events", type: :request do
  let!(:moalboal) { create(:area, slug: "moalboal", name: "Moalboal") }
  let!(:listing) { create(:listing, area: moalboal) }
  let(:session_id) { "3f2b8c1e-7d4a-4c55-9a1e-2b6f0d9e8a71" }

  path "/api/v1/search_events" do
    post "Record a search" do
      tags "Discovery"
      consumes "application/json"
      description "Public. The web app sends one event when a guest picks a search result, or leaves a search " \
        "without picking. Stored for 90 days with the query normalized and `session_id` only as a keyed hash; " \
        "nothing identifies the guest. Feeds search popularity and the admin queues. Rate-limited per IP."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          q: { type: :string, description: "What the guest typed, 2 to 100 characters" },
          result_count: { type: :integer, minimum: 0, description: "How many results the search showed" },
          session_id: { type: :string, description: "A random id the browser keeps for the visit, 8 to 128 characters" },
          target: {
            type: :object,
            nullable: true,
            description: "The result picked; null when none was. An area, landmark or tag by slug, a listing by id.",
            properties: {
              type: { type: :string, enum: %w[area landmark tag listing] },
              slug: { type: :string },
              id: { type: :integer }
            },
            required: %w[type]
          }
        },
        required: %w[q result_count session_id]
      }

      response "204", "a pick is recorded" do
        let(:body) { { q: "  Moalbóal ", result_count: 3, session_id:, target: { type: "area", slug: "moalboal" } } }

        run_test! do
          event = SearchEvent.sole
          expect(event).to have_attributes(query_normalized: "moalboal", result_count: 3, target: moalboal)
          expect(event.session_hash).to match(/\A\h{64}\z/)
          expect(event.session_hash).not_to include(session_id)
        end
      end

      response "204", "a search left without a pick" do
        let(:body) { { q: "kawasan", result_count: 0, session_id:, target: nil } }

        run_test! do
          expect(SearchEvent.sole).to have_attributes(result_count: 0, target_type: nil, target_id: nil)
        end
      end

      response "204", "a listing is picked by id" do
        let(:body) { { q: "gopro", result_count: 1, session_id:, target: { type: "listing", id: listing.id } } }

        run_test! do
          expect(SearchEvent.sole.target).to eq(listing)
        end
      end

      response "422", "missing and wrong-typed values" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { q: [ "moalboal" ], result_count: "3", session_id: 42 } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "Query must be 2 to 100 characters", "Result count must be a whole number, 0 or more",
            "Session id must be 8 to 128 characters"
          )
          expect(SearchEvent.count).to eq(0)
        end
      end

      response "422", "a target that doesn't exist or isn't public" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let!(:draft) { create(:area, :draft, slug: "badian") }
        let(:body) { { q: "badian", result_count: 1, session_id:, target: { type: "area", slug: "badian" } } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Target not found" ])
        end
      end

      response "422", "an unknown target type" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { q: "moalboal", result_count: 1, session_id:, target: { type: "user", slug: "moalboal" } } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Target type must be one of area, landmark, tag, listing" ])
        end
      end

      response "429", "too many events from one IP" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { { q: "moalboal", result_count: 1, session_id:, target: nil } }

        before do
          allow(Api::V1::SearchEventsController.cache_store).to receive(:increment)
            .and_return(Api::V1::SearchEventsController::RATE_LIMIT[:to] + 1)
        end

        run_test!
      end
    end
  end
end
