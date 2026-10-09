require "rails_helper"

# The API contract. Request specs written with rswag's DSL (path/get/response) both test
# an endpoint and describe it; `rake rswag:specs:swaggerize` writes swagger/v1/openapi.yaml
# from them, and web/src/api/schema.d.ts is generated from that file (script/check-api).

# What explore (RAA-56) says about a destination, nearby or recommended.
EXPLORE_PLACE = {
  type: { type: :string, enum: %w[area landmark] },
  slug: { type: :string },
  name: { type: :string },
  kind: { type: :string, nullable: true, enum: [ *Area::KINDS, nil ], description: "The area's kind; null for a landmark" },
  area_slug: { type: :string, description: "The area page to open: the area itself, or the landmark's area" },
  location: { "$ref" => "#/components/schemas/lat_lng" },
  distance_km: { type: :number, description: "From the starting point, one decimal" }
}.freeze

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
          # A partner's Didit ID check (RAA-44).
          partner_verification: {
            type: :object,
            properties: {
              status: { type: :string, enum: PartnerVerification::STATUSES },
              verified_at: { type: :string, format: "date-time", nullable: true },
              attempts_left: {
                type: :integer, description: "Declined checks left before an hour's wait (3 at most)"
              },
              retry_at: {
                type: :string, format: "date-time", nullable: true,
                description: "Set while the partner must wait before starting another check"
              }
            },
            required: %w[status verified_at attempts_left retry_at]
          },
          partner_verification_start: {
            type: :object,
            properties: {
              url: { type: :string, description: "Didit's hosted page; send the partner there" },
              verification: { "$ref" => "#/components/schemas/partner_verification" }
            },
            required: %w[url verification]
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
          # A guest's trip (RAA-64): what the cart lists. Dates are both set or both null.
          trip: {
            type: :object,
            properties: {
              id: { type: :integer },
              name: { type: :string },
              starts_on: { type: :string, format: :date, nullable: true },
              ends_on: { type: :string, format: :date, nullable: true },
              guests: { type: :integer },
              destinations: {
                type: :array, items: { type: :string },
                description: "Where the items are: each one's island, or else its town or city, in item order"
              },
              updated_at: { type: :string, format: "date-time", description: "Last edited, items included" },
              deletes_on: {
                type: :string, format: :date, nullable: true,
                description: "When its unbooked items are deleted; set for the 7 days before, which start " \
                  "the day after the trip ends, or after 60 days without edits for an undated trip"
              },
              items: {
                type: :array, items: { "$ref" => "#/components/schemas/trip_item" },
                description: "In date order, undated items last"
              }
            },
            required: %w[id name starts_on ends_on guests destinations updated_at deletes_on items]
          },
          trip_item: {
            type: :object,
            properties: {
              id: { type: :integer },
              starts_on: { type: :string, format: :date, nullable: true },
              ends_on: { type: :string, format: :date, nullable: true, description: "Null with starts_on: not bookable until it has a date" },
              quantity: { type: :integer },
              booking_type: {
                type: :string, enum: %w[rental stay activity transfer],
                description: "Its listing's: rentals and stays take a range of days, the others one day"
              },
              area: { "$ref" => "#/components/schemas/area_ref" },
              listing: { "$ref" => "#/components/schemas/listing_summary" }
            },
            required: %w[id starts_on ends_on quantity booking_type area listing]
          },
          trip_suggestion: {
            type: :object,
            properties: {
              trip: {
                allOf: [ { "$ref" => "#/components/schemas/trip" } ], nullable: true,
                description: "The trip to preselect; null means \"New trip\""
              },
              extends_to: {
                type: :object, nullable: true,
                description: "The suggested trip's dates once it takes the item, when they would grow",
                properties: {
                  starts_on: { type: :string, format: :date },
                  ends_on: { type: :string, format: :date }
                },
                required: %w[starts_on ends_on]
              },
              new_trip_name: { type: :string, description: "The name a new trip for this item would get" }
            },
            required: %w[trip extends_to new_trip_name]
          },
          # A listing summary on a guest's map: its location rounded to two decimals (~1 km).
          listing_pin: {
            type: :object,
            properties: {
              id: { type: :integer },
              title: { type: :string },
              category: { type: :string },
              area_slug: { type: :string },
              location: { "$ref" => "#/components/schemas/lat_lng" }
            },
            required: %w[id title category area_slug location]
          },
          # A published landmark on a guest's map, exact location included: it's a public place.
          landmark_pin: {
            type: :object,
            properties: {
              slug: { type: :string },
              name: { type: :string },
              area_slug: { type: :string },
              location: { "$ref" => "#/components/schemas/lat_lng" }
            },
            required: %w[slug name area_slug location]
          },
          lat_lng: {
            type: :object,
            properties: { lat: { type: :number }, lng: { type: :number } },
            required: %w[lat lng]
          },
          # A listing as its own partner sees it, exact location included.
          partner_listing: {
            type: :object,
            properties: {
              id: { type: :integer },
              title: { type: :string },
              description: { type: :string },
              status: { type: :string, enum: %w[draft pending active] },
              category: {
                type: :object,
                properties: {
                  id: { type: :integer },
                  slug: { type: :string },
                  name: { type: :string },
                  booking_type: { type: :string, enum: %w[rental stay activity transfer] }
                },
                required: %w[id slug name booking_type]
              },
              area: { "$ref" => "#/components/schemas/area_ref" },
              address: { "$ref" => "#/components/schemas/profile_address" },
              location: {
                type: :object,
                properties: { lat: { type: :number }, lng: { type: :number } },
                required: %w[lat lng]
              },
              attrs: { type: :object, additionalProperties: true, description: "Matches the category's attribute_schema" },
              landmarks: {
                type: :array, items: { "$ref" => "#/components/schemas/partner_landmark" },
                description: "The landmarks a tour or activity visits, by name; empty for other listings"
              },
              covers: {
                type: :array, items: { "$ref" => "#/components/schemas/area_ref" },
                description: "The destinations those landmarks are in, by name"
              },
              created_at: { type: :string, format: "date-time" },
              updated_at: { type: :string, format: "date-time" }
            },
            required: %w[id title description status category area address location attrs landmarks covers created_at
              updated_at]
          },
          # A published landmark in the partner's tour landmark picker, with its destination.
          partner_landmark: {
            type: :object,
            properties: {
              id: { type: :integer },
              slug: { type: :string },
              name: { type: :string },
              area: { "$ref" => "#/components/schemas/area_ref" },
              destination: {
                allOf: [ { "$ref" => "#/components/schemas/area_ref" } ], nullable: true,
                description: "The published island the landmark is on, otherwise its town or city"
              },
              location: { "$ref" => "#/components/schemas/lat_lng" }
            },
            required: %w[id slug name area destination location]
          },
          partner_landmarks: {
            type: :object,
            properties: {
              landmarks: { type: :array, items: { "$ref" => "#/components/schemas/partner_landmark" } },
              destinations: {
                type: :array,
                description: "Every destination with a published landmark, by name, whatever the filters",
                items: {
                  type: :object,
                  properties: { slug: { type: :string }, name: { type: :string }, landmark_count: { type: :integer } },
                  required: %w[slug name landmark_count]
                }
              }
            },
            required: %w[landmarks destinations]
          },
          # What a partner sends to add or change a listing; `status` is never taken from it.
          listing_body: {
            type: :object,
            properties: {
              title: { type: :string, maxLength: 120 },
              description: { type: :string, maxLength: 5000 },
              category_id: { type: :integer, description: "A bookable (leaf) category" },
              address: {
                type: :object,
                properties: {
                  street: { type: :string },
                  city: { type: :string },
                  region: { type: :string },
                  province: { type: :string, nullable: true, description: "Optional: none in Metro Manila" },
                  postal_code: { type: :string },
                  country: { type: :string, description: "ISO 3166-1 alpha-2, e.g. PH" }
                },
                required: %w[street city region postal_code country]
              },
              location: {
                type: :object,
                properties: {
                  lat: { type: :number, minimum: -90, maximum: 90 },
                  lng: { type: :number, minimum: -180, maximum: 180 }
                },
                required: %w[lat lng]
              },
              attrs: { type: :object, additionalProperties: true },
              landmark_ids: {
                type: :array, items: { type: :integer }, maxItems: 30,
                description: "Tours and activities only: the published landmarks it visits. Replaces them when " \
                  "sent; left out on a change, they stay as they are. A listing that isn't an activity has none."
              }
            },
            required: %w[title category_id address location]
          },
          listing_options: {
            type: :object,
            properties: {
              categories: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    id: { type: :integer },
                    slug: { type: :string },
                    name: { type: :string },
                    booking_type: { type: :string, enum: %w[rental stay activity transfer] },
                    parent_name: { type: :string, nullable: true },
                    attribute_schema: {
                      type: :object, additionalProperties: true,
                      description: "The JSON Schema a listing's attrs must match"
                    }
                  },
                  required: %w[id slug name booking_type parent_name attribute_schema]
                }
              }
            },
            required: %w[categories]
          },
          area: {
            type: :object,
            properties: {
              slug: { type: :string },
              name: { type: :string },
              kind: { type: :string, enum: %w[region province city town island] },
              parent_name: { type: :string, nullable: true },
              parent_slug: { type: :string, nullable: true }
            },
            required: %w[slug name kind parent_name parent_slug]
          },
          area_card: {
            type: :object,
            properties: {
              slug: { type: :string },
              name: { type: :string },
              kind: { type: :string, enum: %w[region province city town island] },
              parent_name: { type: :string, nullable: true },
              parent_slug: { type: :string, nullable: true },
              landmark_count: { type: :integer },
              listing_count: { type: :integer },
              activities: { type: :array, items: { "$ref" => "#/components/schemas/tag" } }
            },
            required: %w[slug name kind parent_name parent_slug landmark_count listing_count activities]
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
          # A destination explore offers: an area, or a landmark with the area whose page it is on.
          explore_place: {
            type: :object,
            properties: EXPLORE_PLACE,
            required: EXPLORE_PLACE.keys.map(&:to_s)
          },
          # A recommended destination: an explore place and the kind of link that brought it.
          explore_recommendation: {
            type: :object,
            properties: EXPLORE_PLACE.merge(reason: { type: :string, enum: DestinationLink::KINDS }),
            required: [ *EXPLORE_PLACE.keys.map(&:to_s), "reason" ]
          },
          # A listing pin and how far it is from the starting point.
          explore_listing: {
            type: :object,
            properties: {
              id: { type: :integer },
              title: { type: :string },
              category: { type: :string },
              area_slug: { type: :string },
              location: { "$ref" => "#/components/schemas/lat_lng" },
              distance_km: { type: :number, description: "From the starting point's exact point, one decimal" }
            },
            required: %w[id title category area_slug location distance_km]
          },
          explore: {
            type: :object,
            properties: {
              anchor: {
                type: :object,
                properties: {
                  type: { type: :string, enum: %w[area landmark pin] },
                  slug: { type: :string, nullable: true },
                  name: { type: :string, nullable: true },
                  kind: { type: :string, nullable: true, enum: [ *Area::KINDS, nil ], description: "An area's kind; null otherwise" },
                  isolated_to: {
                    type: :object, nullable: true,
                    description: "The island results are kept to, when the starting point is on one",
                    properties: { slug: { type: :string }, name: { type: :string } },
                    required: %w[slug name]
                  },
                  location: { "$ref" => "#/components/schemas/lat_lng" }
                },
                required: %w[type slug name kind isolated_to location]
              },
              listings: { type: :array, items: { "$ref" => "#/components/schemas/explore_listing" } },
              destinations: { type: :array, items: { "$ref" => "#/components/schemas/explore_place" } },
              recommendations: { type: :array, items: { "$ref" => "#/components/schemas/explore_recommendation" } }
            },
            required: %w[anchor listings destinations recommendations]
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
                    parent_name: { type: :string, nullable: true },
                    parent_slug: { type: :string, nullable: true }
                  },
                  required: %w[slug name kind parent_name parent_slug]
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
          },
          # Admin search and link queues (RAA-60).
          place_key: {
            type: :object,
            description: "An area, landmark or tag, by slug",
            properties: {
              type: { type: :string, enum: %w[area landmark tag] },
              slug: { type: :string }
            },
            required: %w[type slug]
          },
          place_ref: {
            type: :object,
            properties: {
              type: { type: :string, enum: %w[area landmark tag] },
              slug: { type: :string },
              name: { type: :string }
            },
            required: %w[type slug name]
          },
          search_term_queue_entry: {
            type: :object,
            properties: {
              query: { type: :string, description: "Normalized: lower case, no accents" },
              searches: { type: :integer },
              picks: { type: :integer, description: "Searches where a result was picked" },
              zero_results: { type: :integer, description: "Searches that found nothing" }
            },
            required: %w[query searches picks zero_results]
          },
          search_term_target: {
            type: :object,
            properties: {
              type: { type: :string, enum: %w[area landmark tag] },
              slug: { type: :string },
              name: { type: :string },
              aliases: { type: :array, items: { type: :string } }
            },
            required: %w[type slug name aliases]
          },
          link_suggestion: {
            type: :object,
            properties: {
              source: { "$ref" => "#/components/schemas/place_ref" },
              target: { "$ref" => "#/components/schemas/place_ref" },
              sessions: { type: :integer, description: "Visits in which guests picked both" }
            },
            required: %w[source target sessions]
          },
          destination_link: {
            type: :object,
            properties: {
              source: { "$ref" => "#/components/schemas/place_ref" },
              target: { "$ref" => "#/components/schemas/place_ref" },
              kind: { type: :string, enum: DestinationLink::KINDS },
              weight: { type: :integer }
            },
            required: %w[source target kind weight]
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
