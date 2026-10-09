require "swagger_helper"

RSpec.describe "Admin search terms", type: :request do
  include ActiveJob::TestHelper

  let!(:badian) { create(:area, slug: "badian", name: "Badian") }
  let!(:kawasan) { create(:landmark, area: badian, slug: "kawasan-falls", name: "Kawasan Falls", aliases: [ "Kawasan" ]) }

  # Creating the places above queued refreshes of their own.
  before { clear_enqueued_jobs }

  path "/api/v1/admin/search_terms" do
    post "Add a search term to a place" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only. Adds the query as an alias of an area, landmark or tag, so the search box finds the " \
        "place by it once the search index refreshes (queued right away). An alias the place already has, in " \
        "any case or accents, is not added twice."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          query: { type: :string, description: "The search term, 2 to 100 characters" },
          target: { "$ref" => "#/components/schemas/place_key" }
        },
        required: %w[query target]
      }

      let(:user) { create(:user, :admin) }
      let(:Authorization) { bearer_for(user) }

      response "201", "the alias is added and the index refresh queued" do
        schema "$ref" => "#/components/schemas/search_term_target"
        let(:body) { { query: " kawasn ", target: { type: "landmark", slug: "kawasan-falls" } } }

        run_test! do |response|
          expect(response.parsed_body).to eq(
            "type" => "landmark", "slug" => "kawasan-falls", "name" => "Kawasan Falls", "aliases" => %w[Kawasan kawasn]
          )
          expect(SearchTerms::RefreshJob).to have_been_enqueued
        end
      end

      response "201", "an alias the place already has is not repeated" do
        schema "$ref" => "#/components/schemas/search_term_target"
        let(:body) { { query: "KAWASÁN", target: { type: "landmark", slug: "kawasan-falls" } } }

        run_test! do |response|
          expect(response.parsed_body["aliases"]).to eq([ "Kawasan" ])
          expect(SearchTerms::RefreshJob).not_to have_been_enqueued
        end
      end

      response "422", "a query too short and an unknown target type" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { query: "k", target: { type: "listing", slug: "kawasan-falls" } } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "Query must be 2 to 100 characters", "Target type must be one of area, landmark, tag"
          )
        end
      end

      response "422", "a missing target" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { query: "kawasn" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Target must be an object" ])
        end
      end

      response "404", "no such place" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { { query: "kawasn", target: { type: "area", slug: "nowhere" } } }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }
        let(:body) { { query: "kawasn", target: { type: "landmark", slug: "kawasan-falls" } } }

        run_test! do
          expect(kawasan.reload.aliases).to eq([ "Kawasan" ])
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }
        let(:body) { { query: "kawasn", target: { type: "landmark", slug: "kawasan-falls" } } }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }
        let(:body) { { query: "kawasn", target: { type: "landmark", slug: "kawasan-falls" } } }

        run_test!
      end
    end
  end

  it "makes the place findable by the new term once the index refreshes" do
    create(:listing, area: badian)
    post "/api/v1/admin/search_terms", headers: { "Authorization" => bearer_for(create(:user, :admin)) },
      params: { query: "kawasn", target: { type: "landmark", slug: "kawasan-falls" } }, as: :json
    perform_enqueued_jobs

    get "/api/v1/search", params: { q: "kawasn" }

    expect(response.parsed_body["landmarks"].pluck("slug")).to eq([ "kawasan-falls" ])
  end
end
