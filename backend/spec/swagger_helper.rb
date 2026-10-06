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
          # A profile's address; fields are null until the profile is first saved.
          profile_address: {
            type: :object,
            properties: {
              street: { type: :string, nullable: true },
              city: { type: :string, nullable: true },
              region: { type: :string, nullable: true },
              province: { type: :string, nullable: true, description: "Null where there is none" },
              postal_code: { type: :string, nullable: true },
              country: { type: :string, nullable: true, description: "ISO 3166-1 alpha-2, e.g. PH" }
            },
            required: %w[street city region province postal_code country]
          },
          partner_profile: {
            type: :object,
            properties: {
              display_name: { type: :string, nullable: true, description: "Shown to travellers; optional" },
              legal_first_name: { type: :string, nullable: true },
              legal_last_name: { type: :string, nullable: true },
              phone: { type: :string, nullable: true },
              email: { type: :string, description: "Read-only here" },
              address: { "$ref" => "#/components/schemas/profile_address" },
              complete: { type: :boolean, description: "True once the profile is saved and a phone is set" }
            },
            required: %w[display_name legal_first_name legal_last_name phone email address complete]
          },
          guest_profile: {
            type: :object,
            properties: {
              legal_first_name: { type: :string, nullable: true },
              legal_last_name: { type: :string, nullable: true },
              phone: { type: :string, nullable: true },
              email: { type: :string, description: "Read-only here" },
              address: { "$ref" => "#/components/schemas/profile_address" },
              complete: { type: :boolean, description: "True once the profile is saved and a phone is set" }
            },
            required: %w[legal_first_name legal_last_name phone email address complete]
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
          },
          area_ref: {
            type: :object,
            properties: { slug: { type: :string }, name: { type: :string } },
            required: %w[slug name]
          },
          tag: {
            type: :object,
            properties: {
              slug: { type: :string },
              name: { type: :string },
              kind: { type: :string, enum: %w[activity feature theme] }
            },
            required: %w[slug name kind]
          },
          # A listing as guests see it: never its location (revealed only after a paid booking).
          listing_summary: {
            type: :object,
            properties: {
              id: { type: :integer },
              title: { type: :string },
              category: { type: :string },
              area_slug: { type: :string }
            },
            required: %w[id title category area_slug]
          },
          area: {
            type: :object,
            properties: {
              slug: { type: :string },
              name: { type: :string },
              kind: { type: :string, enum: %w[region province city town island] },
              parent_name: { type: :string, nullable: true }
            },
            required: %w[slug name kind parent_name]
          },
          area_card: {
            type: :object,
            properties: {
              slug: { type: :string },
              name: { type: :string },
              kind: { type: :string, enum: %w[region province city town island] },
              parent_name: { type: :string, nullable: true },
              landmark_count: { type: :integer },
              listing_count: { type: :integer },
              activities: { type: :array, items: { "$ref" => "#/components/schemas/tag" } }
            },
            required: %w[slug name kind parent_name landmark_count listing_count activities]
          },
          area_detail: {
            type: :object,
            properties: {
              area: { "$ref" => "#/components/schemas/area" },
              areas: {
                type: :array,
                description: "Areas under this one that have something to book",
                items: { "$ref" => "#/components/schemas/area" }
              },
              landmarks: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    slug: { type: :string },
                    name: { type: :string },
                    description: { type: :string },
                    tags: { type: :array, items: { "$ref" => "#/components/schemas/tag" } }
                  },
                  required: %w[slug name description tags]
                }
              },
              listings: {
                type: :array,
                items: {
                  type: :object,
                  description: "A listing summary plus its booking type; no location",
                  properties: {
                    id: { type: :integer },
                    title: { type: :string },
                    category: { type: :string },
                    area_slug: { type: :string },
                    booking_type: { type: :string, enum: %w[rental stay activity transfer] }
                  },
                  required: %w[id title category area_slug booking_type]
                }
              }
            },
            required: %w[area areas landmarks listings]
          },
          activity: {
            type: :object,
            properties: {
              slug: { type: :string },
              name: { type: :string },
              area_count: { type: :integer },
              landmark_count: { type: :integer }
            },
            required: %w[slug name area_count landmark_count]
          },
          search_results: {
            type: :object,
            properties: {
              areas: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    slug: { type: :string },
                    name: { type: :string },
                    kind: { type: :string, enum: %w[region province city town island] },
                    parent_name: { type: :string, nullable: true }
                  },
                  required: %w[slug name kind parent_name]
                }
              },
              landmarks: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    slug: { type: :string },
                    name: { type: :string },
                    area: { "$ref" => "#/components/schemas/area_ref" }
                  },
                  required: %w[slug name area]
                }
              },
              tags: {
                type: :array,
                description: "Matching tags, each with the bookable areas that have landmarks carrying it, " \
                  "most landmarks first",
                items: {
                  type: :object,
                  properties: {
                    slug: { type: :string },
                    name: { type: :string },
                    kind: { type: :string, enum: %w[activity feature theme] },
                    areas: {
                      type: :array,
                      items: {
                        type: :object,
                        properties: {
                          slug: { type: :string },
                          name: { type: :string },
                          landmark_count: { type: :integer }
                        },
                        required: %w[slug name landmark_count]
                      }
                    }
                  },
                  required: %w[slug name kind areas]
                }
              },
              listings: { type: :array, items: { "$ref" => "#/components/schemas/listing_summary" } }
            },
            required: %w[areas landmarks tags listings]
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
