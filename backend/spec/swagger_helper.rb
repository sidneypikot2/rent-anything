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
        },
        schemas: {
          user: {
            type: :object,
            properties: {
              id: { type: :integer },
              email: { type: :string },
              name: { type: :string, nullable: true },
              phone: { type: :string, nullable: true },
              role: { type: :string, enum: %w[guest partner admin] },
              registration_complete: {
                type: :boolean,
                description: "False until name and phone are set (PUT /api/v1/me/complete_profile)"
              }
            },
            required: %w[id email name phone role registration_complete]
          },
          auth_tokens: {
            type: :object,
            properties: {
              access_token: { type: :string },
              refresh_token: { type: :string },
              expires_in: { type: :integer, description: "Seconds until the access token expires" },
              user: { "$ref" => "#/components/schemas/user" }
            },
            required: %w[access_token refresh_token expires_in user]
          },
          error: {
            type: :object,
            properties: { error: { type: :string } },
            required: %w[error]
          },
          validation_errors: {
            type: :object,
            properties: { errors: { type: :array, items: { type: :string } } },
            required: %w[errors]
          }
        }
      }
    }
  }

  config.openapi_format = :yaml
  # Fail a spec whose response has keys its schema doesn't declare, so the contract
  # can't silently fall behind the code.
  config.openapi_strict_schema_validation = true
end
