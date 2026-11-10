require "swagger_helper"

RSpec.describe "Visits", type: :request do
  path "/api/v1/visits" do
    post "Count a visit to a guest page" do
      tags "Analytics"
      consumes "application/json"
      description "RAA-290. The web app sends a random UUID it keeps in the browser, once a day. The API keeps only " \
        "a digest of it with the day, so each browser counts once per Manila day for the admin overview's " \
        "visitors and can't be followed from one day to the next. No IP or user agent is stored."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { visitor_id: { type: :string, format: :uuid } },
        required: %w[visitor_id]
      }

      let(:visitor_id) { SecureRandom.uuid }
      let(:body) { { visitor_id: } }

      response "204", "counted (or already counted today)" do
        run_test! do
          expect(SiteVisit.count).to eq(1)
          visit = SiteVisit.last
          expect(visit.visited_on).to eq(ActiveSupport::TimeZone["Asia/Manila"].today)
          expect(visit.visitor_digest).not_to include(visitor_id)
        end

        context "when the same browser comes back the same day" do
          before { Visits::Record.call(visitor_id.upcase) }

          run_test! do
            expect(SiteVisit.count).to eq(1)
          end
        end
      end

      response "422", "not a UUID" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { visitor_id: "not-a-uuid" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Visitor id must be a UUID" ])
          expect(SiteVisit.count).to eq(0)
        end
      end

      response "422", "no visitor id" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { {} }

        run_test! do
          expect(SiteVisit.count).to eq(0)
        end
      end

      response "429", "too many from one IP" do
        schema "$ref" => "#/components/schemas/error"
        before do
          allow(Api::V1::VisitsController.cache_store).to receive(:increment).and_return(31)
        end

        run_test! do
          expect(SiteVisit.count).to eq(0)
        end
      end
    end
  end
end
