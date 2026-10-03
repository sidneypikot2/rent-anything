require "rails_helper"

# The API contract. Request specs written with rswag's DSL (path/get/response) both test
# an endpoint and describe it; `rake rswag:specs:swaggerize` writes swagger/v1/openapi.yaml
# from them, and web/src/api/schema.d.ts is generated from that file (script/check-api).
RSpec.configure do |config|
  # OPENAPI_ROOT lets script/check-api generate into a scratch directory to compare.
  config.openapi_root = ENV.fetch("OPENAPI_ROOT", Rails.root.join("swagger").to_s)

  config.openapi_specs = {
    "v1/openapi.yaml" => {
      openapi: "3.0.3",
      info: { title: "Rent-Anything API", version: "v1" },
      paths: {},
      servers: [ { url: "http://localhost:3000" } ],
      components: {
        securitySchemes: {
          bearer: { type: :http, scheme: :bearer, bearerFormat: "JWT" }
        }
      }
    }
  }

  config.openapi_format = :yaml
  # Fail a spec whose response has keys its schema doesn't declare, so the contract
  # can't silently fall behind the code.
  config.openapi_strict_schema_validation = true
end
