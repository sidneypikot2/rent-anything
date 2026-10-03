require "swagger_helper"

RSpec.describe "Health", type: :request do
  path "/api/v1/health" do
    get "Liveness and database check" do
      tags "Health"
      produces "application/json"

      response "200", "the API and its database answer" do
        schema type: :object,
          properties: {
            status: { type: :string, enum: [ "ok" ] },
            postgis: { type: :string }
          },
          required: %w[status postgis]

        run_test!
      end
    end
  end
end
