require "rails_helper"

# The API contract. Request specs written with rswag's DSL (path/get/response) both test
# an endpoint and describe it; `rake rswag:specs:swaggerize` writes swagger/v1/openapi.yaml
# from them, and web/src/api/schema.d.ts is generated from that file (script/check-api).

# A listing's first photo (RAA-106), on every listing a guest sees in a list.
COVER_PHOTO_URL = {
  type: :string, nullable: true,
  description: "The cover photo, sized for a card (about 800 by 600); null when the listing has no photos"
}.freeze

# A stay's split into rooms (RAA-182), on a trip item and a booking: null when the guests
# are spread evenly over the fewest rooms that sleep them.
ROOM_GUESTS = {
  type: :array, nullable: true,
  items: {
    type: :object,
    properties: { adults: { type: :integer }, children: { type: :integer }, infants: { type: :integer } },
    required: %w[adults children infants]
  },
  description: "A stay's guests room by room, as the guest split them; null when spread evenly"
}.freeze

# Where guests find a listing (Category#guest_group): its booking type, except gear.
LISTING_GROUP = {
  type: :string, enum: %w[activity transfer rental stay gear],
  description: "Where guests find it: its booking type, except gear (cameras, snorkel sets), which isn't a " \
    "vehicle rental: its own section, never a trip's \"Getting around\""
}.freeze

# An area's last seeding run from the admin console (RAA-168), on its list row and its page.
SEED_RUN = {
  seed_status: { type: :string, enum: Area::SEED_STATUSES },
  seeded_at: { type: :string, format: "date-time", nullable: true, description: "When the last run ended" },
  seed_report: {
    type: :object,
    description: "The last run: what it added and skipped, or the error it stopped on. All null (and " \
      "skipped empty) before the first run ends",
    properties: {
      landmarks_added: { type: :integer, nullable: true },
      enriched: { type: :integer, nullable: true, description: "Places given Wikidata's terms and popularity" },
      skipped: { type: :array, items: { type: :string }, description: "Places Wikidata couldn't match, and why" },
      error: { type: :string, nullable: true, description: "Set when the run failed" }
    },
    required: %w[landmarks_added enriched skipped error]
  }
}.freeze

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

# The address and map pin a partner sends for a listing (RAA-41) or a business (RAA-100).
ADDRESS_BODY = {
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
}.freeze

LOCATION_BODY = {
  type: :object,
  properties: {
    lat: { type: :number, minimum: -90, maximum: 90 },
    lng: { type: :number, minimum: -180, maximum: 180 }
  },
  required: %w[lat lng]
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
              email: {
                type: :string, nullable: true,
                description: "Null for a guest without an account who hasn't checked out yet (POST /api/v1/guest_sessions)"
              },
              name: { type: :string, nullable: true },
              phone: { type: :string, nullable: true },
              role: { type: :string, enum: %w[guest partner admin] },
              registration_complete: {
                type: :boolean,
                description: "False until name and phone are set (PUT /api/v1/me/complete_profile)"
              },
              registered: {
                type: :boolean,
                description: "Has a password or a Google or Facebook sign-in. A guest who isn't has their trips deleted " \
                  "60 days after each ends; POST /api/v1/me/register sets a password"
              }
            },
            required: %w[id email name phone role registration_complete registered]
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
              group: LISTING_GROUP,
              area_slug: { type: :string },
              instant_book: { type: :boolean, description: "Booked at once, without asking the partner (RAA-132): its pill" },
              cover_photo_url: COVER_PHOTO_URL
            },
            required: %w[id title category group area_slug instant_book cover_photo_url]
          },
          # A guest's trip (RAA-64): what the cart lists. Dates are both set or both null.
          trip: {
            type: :object,
            properties: {
              id: { type: :integer },
              name: { type: :string },
              starts_on: { type: :string, format: :date, nullable: true },
              ends_on: { type: :string, format: :date, nullable: true },
              guests: { type: :integer, description: "The whole party: adults, children and infants" },
              children: { type: :integer, description: "Of the guests (RAA-182)" },
              infants: { type: :integer, description: "Of the guests (RAA-182)" },
              pets: { type: :integer, description: "Beside the guests (RAA-182)" },
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
            required: %w[id name starts_on ends_on guests children infants pets destinations updated_at deletes_on items]
          },
          trip_item: {
            type: :object,
            properties: {
              id: { type: :integer },
              starts_on: { type: :string, format: :date, nullable: true },
              ends_on: { type: :string, format: :date, nullable: true, description: "Null with starts_on: not bookable until it has a date" },
              quantity: { type: :integer },
              room_guests: ROOM_GUESTS,
              pets: { type: :integer, description: "A stay's pets (RAA-182)" },
              sleeps: {
                type: :integer, nullable: true,
                description: "A stay: the most guests it sleeps, all its units together (a shared room's beds); " \
                  "null for anything else, or a stay that doesn't say"
              },
              max_guests: {
                type: :integer, nullable: true,
                description: "The most guests the item can be for: a tour's group, the guests a stay sleeps, or a " \
                  "transfer's or a trike's seats (one vehicle a booking); null when the listing doesn't say"
              },
              booking_type: {
                type: :string, enum: %w[rental stay activity transfer],
                description: "Its listing's: rentals and stays take a range of days, the others one day"
              },
              area: { "$ref" => "#/components/schemas/area_ref" },
              destination: {
                allOf: [ { "$ref" => "#/components/schemas/area_ref" } ], nullable: true,
                description: "Where it is, as the trip's destinations say it: the published island its listing's area is on, " \
                  "otherwise its town or city. The cart lists a trip's items under it when the trip goes to more than one"
              },
              listing: { "$ref" => "#/components/schemas/listing_summary" },
              booking: {
                allOf: [ { "$ref" => "#/components/schemas/booking_ref" } ], nullable: true,
                description: "Its booking while one holds its days (RAA-132); a booked item can't be changed or removed"
              },
              unavailable: {
                type: :string, nullable: true,
                description: "Why its listing can't have it on its days still ahead: a day blocked or with nothing left " \
                  "(\"Nov 18 is fully booked\", " \
                  "\"No longer offered\"), checked against the partner's calendar; null when it can, or when it is " \
                  "booked, undated or past. The item stays in the trip: the guest picks another or new dates"
              },
              cancellation_policy: {
                type: :string, enum: %w[free_cancellation seven_days fourteen_days non_refundable],
                description: "The listing's, which a booking made now would be under (RAA-139)"
              },
              listing_active: { type: :boolean, description: "False once the listing is paused or delisted: it can't be booked" }
            },
            required: %w[id starts_on ends_on quantity room_guests pets sleeps max_guests booking_type area destination listing booking unavailable cancellation_policy listing_active]
          },
          # A trip's view-only share link (RAA-176), as its guest sees it.
          trip_share: {
            type: :object,
            properties: {
              token: { type: :string, nullable: true, description: "Null while the trip isn't shared" },
              path: {
                type: :string, nullable: true,
                description: "The web app's page for it, /trips/shared/<token>; null while the trip isn't shared"
              }
            },
            required: %w[token path]
          },
          # A trip as its share link shows it to anyone (RAA-176): no prices, contact details,
          # booking references or ids that act on the trip.
          shared_trip: {
            type: :object,
            properties: {
              name: { type: :string },
              starts_on: { type: :string, format: :date, nullable: true },
              ends_on: { type: :string, format: :date, nullable: true },
              guests: { type: :integer },
              destinations: {
                type: :array, items: { type: :string },
                description: "Where the items are: each one's island, or else its town or city, in item order"
              },
              items: {
                type: :array, description: "In date order, undated items last",
                items: {
                  type: :object,
                  properties: {
                    starts_on: { type: :string, format: :date, nullable: true },
                    ends_on: { type: :string, format: :date, nullable: true },
                    booking_type: { type: :string, enum: %w[rental stay activity transfer] },
                    area: { "$ref" => "#/components/schemas/area_ref" },
                    listing: {
                      type: :object,
                      properties: {
                        id: { type: :integer, description: "Links to the listing's public page" },
                        title: { type: :string },
                        cover_photo_url: COVER_PHOTO_URL
                      },
                      required: %w[id title cover_photo_url]
                    },
                    booking_status: {
                      allOf: [ { "$ref" => "#/components/schemas/booking_status" } ], nullable: true,
                      description: "Its booking's while one holds its days; null while it is only planned"
                    }
                  },
                  required: %w[starts_on ends_on booking_type area listing booking_status]
                }
              }
            },
            required: %w[name starts_on ends_on guests destinations items]
          },
          # What a trip's items would cost if booked now (RAA-139, GET /trips/:id/quote).
          trip_quote: {
            type: :object,
            properties: {
              trip_id: { type: :integer },
              total_cents: { type: :integer, description: "The items without a problem, booked ones at their booking's total" },
              to_be_agreed_count: { type: :integer, description: "Items priced with the partner, counted as ₱0 in the total" },
              items: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    trip_item_id: { type: :integer },
                    total_cents: { type: :integer, nullable: true, description: "Null with a problem" },
                    to_be_agreed: { type: :boolean, description: "A rental or transfer: priced with the partner" },
                    problem: { type: :string, nullable: true, description: "Why it can't be booked as it is" }
                  },
                  required: %w[trip_item_id total_cents to_be_agreed problem]
                }
              }
            },
            required: %w[trip_id total_cents to_be_agreed_count items]
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
              group: LISTING_GROUP,
              area_slug: { type: :string },
              instant_book: { type: :boolean, description: "Booked at once, without asking the partner (RAA-132)" },
              cover_photo_url: COVER_PHOTO_URL,
              location: { "$ref" => "#/components/schemas/lat_lng" },
              booking_type: { type: :string, enum: %w[rental stay activity transfer] },
              price_from_cents: {
                type: :integer, nullable: true,
                description: "A stay's nightly price or a tour's base price, in centavos; null with no price yet or for any other category"
              },
              price_unit: { "$ref" => "#/components/schemas/price_unit" }
            },
            required: %w[id title category group area_slug instant_book cover_photo_url location booking_type price_from_cents price_unit]
          },
          # One active listing as a traveller sees it (RAA-86). Never its location or address.
          listing_detail: {
            type: :object,
            properties: {
              id: { type: :integer },
              title: { type: :string },
              description: { type: :string },
              instant_book: { type: :boolean, description: "Booked at once, without asking the partner (RAA-132)" },
              summary: {
                type: :string,
                description: "The description's first non-blank line, cut to 160 characters; empty when there is none"
              },
              category: {
                type: :object,
                properties: { slug: { type: :string }, name: { type: :string } },
                required: %w[slug name]
              },
              booking_type: { type: :string, enum: %w[rental stay activity transfer] },
              area: { "$ref" => "#/components/schemas/area_ref" },
              business: { "$ref" => "#/components/schemas/business_ref" },
              units_count: { type: :integer, minimum: 1, description: "How many identical items, rooms or vehicles it has" },
              units_label: { type: :string, description: "units_count in the category's words, e.g. \"5 rooms\"" },
              partner_name: {
                type: :string, deprecated: true,
                description: "The business's name, as in business.name; will be removed (RAA-101)"
              },
              price_from_cents: {
                type: :integer, nullable: true,
                description: "Accommodation: the nightly price; a tour: its base price (RAA-110). In centavos; null " \
                  "with no price yet or for any other category"
              },
              price_unit: { "$ref" => "#/components/schemas/price_unit" },
              guests: { type: :integer, nullable: true, description: "Accommodation: the most guests it sleeps; null otherwise" },
              stay_rate: {
                allOf: [ { "$ref" => "#/components/schemas/stay_rate" } ], nullable: true,
                description: "Accommodation's nightly pricing once it has a price; null otherwise"
              },
              vehicle_rate: {
                allOf: [ { "$ref" => "#/components/schemas/vehicle_rate" } ], nullable: true,
                description: "A vehicle rental's pricing once it has a price (RAA-149); null otherwise. Not quoted " \
                  "at checkout yet: the price is confirmed with the partner"
              },
              fees: { type: :array, items: { "$ref" => "#/components/schemas/listing_fee" } },
              tour: {
                allOf: [ { "$ref" => "#/components/schemas/guest_tour" } ], nullable: true,
                description: "A tour's details and the days it runs; null for any other category"
              },
              details: { "$ref" => "#/components/schemas/listing_details" },
              photos: {
                type: :array, items: { "$ref" => "#/components/schemas/photo_urls" },
                description: "Its photos ready for guests (see partner_photo.ready), in the partner's order; the first is the cover"
              }
            },
            required: %w[id title description summary category booking_type instant_book area business units_count units_label
              partner_name price_from_cents price_unit guests stay_rate vehicle_rate fees tour details photos]
          },
          # A listing photo's sizes (RAA-106), served straight from storage. A partner's photo not
          # ready yet (partner_photo) gives the original for both.
          photo_urls: {
            type: :object,
            properties: {
              card_url: { type: :string, description: "Cropped to fill about 800 by 600" },
              large_url: { type: :string, description: "The whole photo, at most 1600 on its longer side" }
            },
            required: %w[card_url large_url]
          },
          # A listing photo as its partner sees it: photo_urls plus the id a listing's photos take.
          partner_photo: {
            type: :object,
            properties: {
              id: { type: :integer, description: "As sent in a listing's photos" },
              uploaded: {
                type: :boolean,
                description: "False until its upload is confirmed; until then the URLs may have nothing behind them"
              },
              ready: {
                type: :boolean,
                description: "True once its metadata is stripped and its sizes are made, a few seconds after the " \
                  "upload is confirmed; guests see only ready photos, and until then both URLs are the original's"
              },
              card_url: { type: :string },
              large_url: { type: :string }
            },
            required: %w[id uploaded ready card_url large_url]
          },
          # The business offering a listing, as a guest sees it (RAA-100).
          business_ref: {
            type: :object,
            description: "Who offers it; an area page groups its rows by business (names are unique per partner only)",
            properties: { id: { type: :integer }, name: { type: :string } },
            required: %w[id name]
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
              status: {
                type: :string, enum: Listing::STATUSES,
                description: "draft, active (live: guests see it), paused or delisted; only active reaches guests"
              },
              live_blockers: {
                type: :array, items: { type: :string, enum: Listing::LIVE_BLOCKERS.keys },
                description: "What it still needs to go live: a ready photo, a description, a price (stays and " \
                  "tours) and a landmark on an activity's route. Empty when it can go live."
              },
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
              cancellation_policy: { "$ref" => "#/components/schemas/cancellation_policy" },
              booking_mode: { "$ref" => "#/components/schemas/booking_mode" },
              units_count: { type: :integer, minimum: 1, description: "How many identical items, rooms or vehicles it has" },
              stay_rate: {
                allOf: [ { "$ref" => "#/components/schemas/stay_rate" } ], nullable: true,
                description: "Accommodation's nightly pricing; null for any other category"
              },
              vehicle_rate: {
                allOf: [ { "$ref" => "#/components/schemas/vehicle_rate" } ], nullable: true,
                description: "A vehicle rental's pricing (RAA-149); null for any other category"
              },
              fees: { type: :array, items: { "$ref" => "#/components/schemas/listing_fee" }, description: "In the partner's order" },
              tour: {
                allOf: [ { "$ref" => "#/components/schemas/partner_tour" } ], nullable: true,
                description: "A tour's details (RAA-110); null for any other category"
              },
              business: {
                type: :object,
                properties: { id: { type: :integer }, name: { type: :string } },
                required: %w[id name]
              },
              landmarks: {
                type: :array, items: { "$ref" => "#/components/schemas/partner_landmark" },
                description: "The landmarks a tour or activity visits, by name; empty for other listings"
              },
              covers: {
                type: :array, items: { "$ref" => "#/components/schemas/area_ref" },
                description: "The destinations those landmarks are in, by name"
              },
              photos: {
                type: :array, items: { "$ref" => "#/components/schemas/partner_photo" },
                description: "In the partner's order; the first is the cover"
              },
              photo_limit: { type: :integer, description: "How many photos it can have: 5 for a tour, 12 otherwise" },
              created_at: { type: :string, format: "date-time" },
              updated_at: { type: :string, format: "date-time" }
            },
            required: %w[id title description status live_blockers category area address location attrs cancellation_policy booking_mode units_count
              stay_rate vehicle_rate fees tour business landmarks covers photos photo_limit created_at updated_at]
          },
          # A business a partner runs (RAA-100); its listings are shown under its name.
          partner_business: {
            type: :object,
            properties: {
              id: { type: :integer },
              name: { type: :string },
              description: { type: :string },
              address: { "$ref" => "#/components/schemas/profile_address" },
              location: {
                allOf: [ { "$ref" => "#/components/schemas/lat_lng" } ], nullable: true,
                description: "The map pin; null on a business made before pins, until the partner sets it"
              },
              listings_count: { type: :integer },
              payout_account: {
                type: :object, nullable: true,
                description: "Where its payouts go (RAA-145); null until the partner picks one of their payout accounts",
                properties: {
                  id: { type: :integer },
                  kind: { type: :string, enum: PayoutAccount::KINDS.keys },
                  label: { type: :string, example: "BDO Unibank •••• 1234" },
                  account_number_last4: { type: :string }
                },
                required: %w[id kind label account_number_last4]
              },
              created_at: { type: :string, format: "date-time" },
              updated_at: { type: :string, format: "date-time" }
            },
            required: %w[id name description address location listings_count payout_account created_at updated_at]
          },
          business_body: {
            type: :object,
            properties: {
              name: { type: :string, maxLength: 80, description: "Unique among the partner's businesses, ignoring case" },
              description: { type: :string, maxLength: 2000, description: "Optional; left out on a change, it stays" },
              address: ADDRESS_BODY.merge(description: "Required on a new business; left out on a change, it stays"),
              location: LOCATION_BODY.merge(description: "Required on a new business; left out on a change, it stays"),
              payout_account_id: {
                type: :integer, nullable: true,
                description: "One of the partner's payout accounts (RAA-145); null clears it, left out it stays"
              }
            },
            required: %w[name]
          },
          # A partner's payout account (RAA-145). The full account number never leaves the API.
          payout_account: {
            type: :object,
            properties: {
              id: { type: :integer },
              kind: { type: :string, enum: PayoutAccount::KINDS.keys },
              bank_code: { type: :string, nullable: true, description: "The bank's code; null for an e-wallet" },
              bank_name: { type: :string, nullable: true },
              account_name: { type: :string },
              account_number_last4: { type: :string },
              label: { type: :string, example: "GCash •••• 4567" },
              businesses: {
                type: :array, description: "The partner's businesses paid out here, by name",
                items: {
                  type: :object,
                  properties: { id: { type: :integer }, name: { type: :string } },
                  required: %w[id name]
                }
              },
              created_at: { type: :string, format: "date-time" },
              updated_at: { type: :string, format: "date-time" }
            },
            required: %w[id kind bank_code bank_name account_name account_number_last4 label businesses created_at
                         updated_at]
          },
          payout_account_body: {
            type: :object,
            properties: {
              kind: { type: :string, enum: PayoutAccount::KINDS.keys, description: "Required on a new account" },
              bank_code: {
                type: :string, enum: PayoutAccount::BANKS.keys,
                description: "Required for a bank account (from payout options); ignored for an e-wallet"
              },
              account_name: { type: :string, maxLength: 100, description: "The name on the account" },
              account_number: {
                type: :string,
                description: "A bank account's 6 to 20 digits, or an e-wallet's mobile number (09171234567 or " \
                  "+639171234567); spaces and dashes are ignored. Required when the kind changes"
              }
            }
          },
          payout_options: {
            type: :object,
            properties: {
              kinds: {
                type: :array,
                items: {
                  type: :object,
                  properties: { value: { type: :string, enum: PayoutAccount::KINDS.keys }, label: { type: :string } },
                  required: %w[value label]
                }
              },
              banks: {
                type: :array,
                items: {
                  type: :object,
                  properties: { code: { type: :string }, name: { type: :string } },
                  required: %w[code name]
                }
              }
            },
            required: %w[kinds banks]
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
          listing_status_body: {
            type: :object,
            properties: {
              status: { type: :string, enum: %w[active paused delisted] }
            },
            required: %w[status]
          },
          listing_body: {
            type: :object,
            properties: {
              title: {
                type: :string, minLength: 10, maxLength: 80,
                description: "A title of an older listing longer than 80 stays until it is changed"
              },
              description: {
                type: :string, maxLength: 2000,
                description: "At least 50 characters for the listing to go live; an older, longer one stays until changed"
              },
              category_id: { type: :integer, description: "A bookable (leaf) category" },
              address: ADDRESS_BODY,
              location: LOCATION_BODY,
              attrs: { type: :object, additionalProperties: true },
              cancellation_policy: {
                allOf: [ { "$ref" => "#/components/schemas/cancellation_policy" } ],
                description: "Left out on adding a listing, it is free_cancellation; left out on a change, it stays as it is"
              },
              booking_mode: {
                allOf: [ { "$ref" => "#/components/schemas/booking_mode" } ],
                description: "Left out on adding a listing, it is request; left out on a change, it stays as it is"
              },
              business_id: {
                type: :integer,
                description: "One of the partner's businesses (RAA-100). Left out on adding a listing, it is the " \
                  "partner's only business, and required when they have several; left out on a change, it stays"
              },
              units_count: {
                type: :integer, minimum: 1, maximum: 100,
                description: "How many identical items, rooms or vehicles it has. Left out on adding a listing, it " \
                  "is 1; left out on a change, it stays as it is"
              },
              landmark_ids: {
                type: :array, items: { type: :integer }, maxItems: 30,
                description: "Tours and activities only: the published landmarks it visits. Replaces them when " \
                  "sent; left out on a change, they stay as they are. A listing that isn't an activity has none."
              },
              stay_rate: {
                allOf: [ { "$ref" => "#/components/schemas/stay_rate_body" } ],
                description: "Accommodation only, and required on a new one or one moved into it: replaces the rate " \
                  "when sent; left out on a change, it stays. Refused for any other category."
              },
              vehicle_rate: {
                allOf: [ { "$ref" => "#/components/schemas/vehicle_rate_body" } ],
                description: "Vehicle rentals only (a category whose attribute_schema asks for make, model and " \
                  "engine_cc), and required on a new one or one moved into it: replaces the rate when sent; left " \
                  "out on a change, it stays. Refused for any other category."
              },
              fees: {
                type: :array, items: { "$ref" => "#/components/schemas/listing_fee_body" }, maxItems: 20,
                description: "Any category. Replaces the listing's fees, in this order, when sent; left out on a " \
                  "change, they stay. Names are unique per listing, ignoring case."
              },
              tour: {
                allOf: [ { "$ref" => "#/components/schemas/tour_body" } ],
                description: "Tours only (category slug `tour`), and required on a new one or one moved into it: " \
                  "replaces the tour's details and inclusions when sent; left out on a change, they stay. " \
                  "Refused for any other category."
              },
              photos: {
                type: :array, items: { type: :integer }, maxItems: 12,
                description: "The ids of the listing's photos (POST /api/v1/partner/listings/{listing_id}/photos) in " \
                  "order, the first uploaded one the cover. A photo left out is deleted; left out on a change, they " \
                  "stay as they are. A new listing has none yet. A tour has at most 5."
              }
            },
            required: %w[title category_id address location]
          },
          # A tour (RAA-110). A private tour is booked by one group: base_price is per group, and
          # each inclusion is an add-on priced per head. A joiner tour sells seats: base_price is
          # per head, its inclusions in the price. Money is in centavos.
          tour_type: { type: :string, enum: %w[private joiner] },
          price_unit: {
            type: :string, enum: %w[night group person day], nullable: true,
            description: "What price_from_cents is for: a night of a stay, a private tour's whole group or one " \
              "joiner, a day of a vehicle rental (RAA-149); null when there is no price"
          },
          tour_inclusion: {
            type: :object,
            properties: {
              kind: { type: :string, enum: %w[accommodation transport meal] },
              options: {
                type: :array, items: { type: :string },
                description: "transport: van, tricycle, boat, motorbike, car or other (at least one); meal: snack, " \
                  "breakfast, lunch or dinner (at least one); accommodation: none. In that order"
              },
              note: { type: :string, maxLength: 120, nullable: true, description: "E.g. \"Beach cottage, 1 night\"" },
              price_per_head_cents: {
                type: :integer, minimum: 0, description: "A private tour's add-on price per guest; 0 on a joiner tour"
              }
            },
            required: %w[kind options note price_per_head_cents]
          },
          tour_inclusion_body: {
            type: :object,
            properties: {
              kind: { type: :string, enum: %w[accommodation transport meal], description: "Each kind at most once" },
              options: { type: :array, items: { type: :string }, description: "As in tour_inclusion" },
              note: { type: :string, maxLength: 120, nullable: true },
              price_per_head_cents: {
                type: :integer, minimum: 0, description: "Required on a private tour; left out (or 0) on a joiner tour"
              }
            },
            required: %w[kind]
          },
          partner_tour: {
            type: :object,
            properties: {
              tour_type: { "$ref" => "#/components/schemas/tour_type" },
              min_guests: { type: :integer, minimum: 1, maximum: 100 },
              max_guests: { type: :integer, minimum: 1, maximum: 100 },
              max_groups_per_day: {
                type: :integer, minimum: 1, maximum: 100,
                description: "Private: bookings a day; joiner: groups filled to max_guests a day. Enforced with " \
                  "bookings (M3)"
              },
              duration_value: { type: :integer, minimum: 1 },
              duration_unit: { type: :string, enum: %w[hours days] },
              base_price_cents: { type: :integer, minimum: 0, description: "0: no price yet (tours made before RAA-110)" },
              price_unit: { type: :string, enum: %w[group person], description: "Private: group; joiner: person" },
              inclusions: {
                type: :array, items: { "$ref" => "#/components/schemas/tour_inclusion" },
                description: "accommodation, meal, transport, each at most once"
              }
            },
            required: %w[tour_type min_guests max_guests max_groups_per_day duration_value duration_unit
              base_price_cents price_unit inclusions]
          },
          guest_tour: {
            type: :object,
            properties: {
              tour_type: { "$ref" => "#/components/schemas/tour_type" },
              min_guests: { type: :integer },
              max_guests: { type: :integer },
              duration_value: { type: :integer },
              duration_unit: { type: :string, enum: %w[hours days] },
              base_price_cents: { type: :integer },
              price_unit: { type: :string, enum: %w[group person] },
              inclusions: { type: :array, items: { "$ref" => "#/components/schemas/tour_inclusion" } }
            },
            required: %w[tour_type min_guests max_guests duration_value duration_unit base_price_cents price_unit
              inclusions]
          },
          tour_body: {
            type: :object,
            description: "The whole tour, replaced when sent. A tour runs every day.",
            properties: {
              tour_type: { "$ref" => "#/components/schemas/tour_type" },
              min_guests: { type: :integer, minimum: 1, maximum: 100 },
              max_guests: { type: :integer, minimum: 1, maximum: 100, description: "At least min_guests" },
              max_groups_per_day: { type: :integer, minimum: 1, maximum: 100 },
              duration_value: { type: :integer, minimum: 1, description: "At most 24 hours or 30 days" },
              duration_unit: { type: :string, enum: %w[hours days] },
              base_price_cents: { type: :integer, minimum: 1 },
              inclusions: {
                type: :array, items: { "$ref" => "#/components/schemas/tour_inclusion_body" }, maxItems: 3,
                description: "Left out: none"
              }
            },
            required: %w[tour_type min_guests max_guests max_groups_per_day duration_value duration_unit base_price_cents]
          },
          # Accommodation's nightly pricing (RAA-104). Money is in centavos.
          stay_rate: {
            type: :object,
            properties: {
              nightly_price_cents: {
                type: :integer, minimum: 0,
                description: "For each night, covering up to base_guests; per guest for a shared room. 0 means no " \
                  "price yet (listings made before pricing), and the listing can't be quoted"
              },
              weekend_price_cents: {
                type: :integer, minimum: 1, nullable: true, description: "For Friday and Saturday nights; null: the nightly price"
              },
              base_guests: { type: :integer, minimum: 1, maximum: 50, description: "Guests the nightly price includes" },
              extra_guest_fee_cents: {
                type: :integer, minimum: 0, description: "Per guest above base_guests, per night, up to attrs.guests"
              },
              weekly_discount_percent: { type: :integer, minimum: 0, maximum: 90, description: "Off stays of 7+ nights" },
              monthly_discount_percent: {
                type: :integer, minimum: 0, maximum: 90, description: "Off stays of 28+ nights; at least the weekly one"
              },
              min_nights: { type: :integer, minimum: 1, maximum: 365 },
              max_nights: { type: :integer, minimum: 1, maximum: 365, nullable: true, description: "Null: no maximum" }
            },
            required: %w[nightly_price_cents weekend_price_cents base_guests extra_guest_fee_cents weekly_discount_percent
              monthly_discount_percent min_nights max_nights]
          },
          stay_rate_body: {
            type: :object,
            description: "A shared room is priced per guest: base_guests 1, no extra-guest fee. base_guests is at most " \
              "attrs.guests. Optional fields left out take their defaults.",
            properties: {
              nightly_price_cents: { type: :integer, minimum: 1 },
              weekend_price_cents: { type: :integer, minimum: 1, nullable: true, description: "Default null" },
              base_guests: { type: :integer, minimum: 1, maximum: 50, description: "Default 1" },
              extra_guest_fee_cents: { type: :integer, minimum: 0, description: "Default 0" },
              weekly_discount_percent: { type: :integer, minimum: 0, maximum: 90, description: "Default 0" },
              monthly_discount_percent: { type: :integer, minimum: 0, maximum: 90, description: "Default 0" },
              min_nights: { type: :integer, minimum: 1, maximum: 365, description: "Default 1" },
              max_nights: { type: :integer, minimum: 1, maximum: 365, nullable: true, description: "Default null" }
            },
            required: %w[nightly_price_cents]
          },
          # A vehicle rental's pricing (RAA-149). Money is in centavos; a weekly or monthly price is
          # the total for 7 or 30 days.
          vehicle_rate: {
            type: :object,
            properties: {
              daily_price_cents: {
                type: :integer, minimum: 0,
                description: "For each day (24 hours). 0 means no price yet (listings made before pricing)"
              },
              half_day_price_cents: {
                type: :integer, minimum: 1, nullable: true, description: "For half_day_hours; null: not offered"
              },
              half_day_hours: { type: :integer, minimum: 2, maximum: 12 },
              hourly_price_cents: { type: :integer, minimum: 1, nullable: true, description: "Null: not offered" },
              weekly_price_cents: {
                type: :integer, minimum: 1, nullable: true, description: "The total for 7 days; null: 7 daily prices"
              },
              monthly_price_cents: {
                type: :integer, minimum: 1, nullable: true, description: "The total for 30 days; null: no monthly price"
              },
              security_deposit_cents: {
                type: :integer, minimum: 0, description: "Refundable, held at pick-up; never part of the price"
              },
              delivery_fee_cents: {
                type: :integer, minimum: 0, nullable: true,
                description: "Bringing the vehicle to the guest: null not offered, 0 free"
              },
              return_pickup_fee_cents: {
                type: :integer, minimum: 0, nullable: true,
                description: "Collecting it from the guest at the end: null not offered, 0 free"
              },
              min_rental_days: { type: :integer, minimum: 1, maximum: 365 },
              km_limit_per_day: { type: :integer, minimum: 1, maximum: 2000, nullable: true, description: "Null: unlimited" },
              excess_km_fee_cents: { type: :integer, minimum: 0, nullable: true, description: "Per km above the daily limit" },
              driving: { "$ref" => "#/components/schemas/vehicle_driving" },
              driver_fee_cents: {
                type: :integer, minimum: 1, nullable: true,
                description: "A driver per day when the guest can choose one (either); otherwise null"
              }
            },
            required: %w[daily_price_cents half_day_price_cents half_day_hours hourly_price_cents weekly_price_cents
              monthly_price_cents security_deposit_cents delivery_fee_cents return_pickup_fee_cents min_rental_days
              km_limit_per_day excess_km_fee_cents driving driver_fee_cents]
          },
          vehicle_rate_body: {
            type: :object,
            description: "A half day costs less than a day and an hour less than a half day (or a day); a week " \
              "at most 7 days and a month at most 30 at the daily price. A fee per km above the limit needs a " \
              "limit. A choice of driver (either) needs a driver fee, and a motorcycle is self-drive only. Optional " \
              "fields left out take their defaults.",
            properties: {
              daily_price_cents: { type: :integer, minimum: 1 },
              half_day_price_cents: { type: :integer, minimum: 1, nullable: true, description: "Default null" },
              half_day_hours: { type: :integer, minimum: 2, maximum: 12, description: "Default 4" },
              hourly_price_cents: { type: :integer, minimum: 1, nullable: true, description: "Default null" },
              weekly_price_cents: { type: :integer, minimum: 1, nullable: true, description: "Default null" },
              monthly_price_cents: { type: :integer, minimum: 1, nullable: true, description: "Default null" },
              security_deposit_cents: { type: :integer, minimum: 0, description: "Default 0" },
              delivery_fee_cents: { type: :integer, minimum: 0, nullable: true, description: "Default null: not offered" },
              return_pickup_fee_cents: { type: :integer, minimum: 0, nullable: true, description: "Default null: not offered" },
              min_rental_days: { type: :integer, minimum: 1, maximum: 365, description: "Default 1" },
              km_limit_per_day: { type: :integer, minimum: 1, maximum: 2000, nullable: true, description: "Default null" },
              excess_km_fee_cents: { type: :integer, minimum: 0, nullable: true, description: "Default null" },
              driving: { "$ref" => "#/components/schemas/vehicle_driving", description: "Default self_drive" },
              driver_fee_cents: {
                type: :integer, minimum: 1, nullable: true, description: "Per day; required with either, null otherwise"
              }
            },
            required: %w[daily_price_cents]
          },
          vehicle_driving: {
            type: :string, enum: %w[self_drive with_driver either],
            description: "Self-drive only, with a driver only (in the price), or either at a driver fee (RAA-150)"
          },
          listing_fee_charged_per: {
            type: :string, enum: %w[booking night guest guest_night unit day hour pet pet_night],
            description: "What the amount is multiplied by in a quote"
          },
          # An extra charge on a listing, any category (RAA-104).
          listing_fee: {
            type: :object,
            properties: {
              id: { type: :integer },
              name: { type: :string },
              amount_cents: { type: :integer, minimum: 0 },
              charged_per: { "$ref" => "#/components/schemas/listing_fee_charged_per" },
              required: { type: :boolean, description: "false: an add-on the guest picks" }
            },
            required: %w[id name amount_cents charged_per required]
          },
          # What a stay costs (RAA-104), in centavos.
          stay_quote: {
            type: :object,
            properties: {
              starts_on: { type: :string, format: :date },
              ends_on: { type: :string, format: :date },
              guests: { type: :integer },
              nights: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    date: { type: :string, format: :date },
                    price_cents: { type: :integer, description: "Per guest for a shared room" },
                    weekend: { type: :boolean, description: "A Friday or Saturday night" }
                  },
                  required: %w[date price_cents weekend]
                }
              },
              nights_count: { type: :integer },
              per_guest: { type: :boolean, description: "A shared room: the nights are charged per guest" },
              nightly_subtotal_cents: { type: :integer, description: "The nights, times the guests for a shared room" },
              extra_guests: { type: :integer, description: "Guests above base_guests" },
              extra_guest_fee_cents: { type: :integer, description: "Per extra guest, per night" },
              extra_guests_total_cents: { type: :integer },
              discount: { "$ref" => "#/components/schemas/stay_discount" },
              fees: {
                type: :array, items: { "$ref" => "#/components/schemas/stay_fee_line" },
                description: "The required fees and the add-ons picked, in the partner's order, every room's together; " \
                  "a fee per pet once for the stay"
              },
              total_cents: { type: :integer },
              rooms: {
                type: :array, items: { "$ref" => "#/components/schemas/stay_quote_room" },
                description: "Each room booked and what it costs (RAA-182): the guest's own split, or the fewest rooms " \
                  "that sleep the party, spread evenly; a shared room is one entry for the whole party"
              },
              rooms_free: { type: :integer, description: "The fewest rooms (a shared room's beds) left on any of the nights" },
              pets: { type: :integer }
            },
            required: %w[starts_on ends_on guests nights nights_count per_guest nightly_subtotal_cents extra_guests
              extra_guest_fee_cents extra_guests_total_cents discount fees total_cents rooms rooms_free pets]
          },
          stay_discount: {
            type: :object, nullable: true,
            description: "Off the nights and extra guests, never the fees; null under 7 nights or with none set",
            properties: {
              kind: { type: :string, enum: %w[weekly monthly] },
              percent: { type: :integer },
              amount_cents: { type: :integer }
            },
            required: %w[kind percent amount_cents]
          },
          stay_fee_line: {
            type: :object,
            properties: {
              id: { type: :integer },
              name: { type: :string },
              charged_per: { "$ref" => "#/components/schemas/listing_fee_charged_per" },
              required: { type: :boolean },
              quantity: { type: :integer, description: "What amount_cents is multiplied by" },
              amount_cents: { type: :integer },
              total_cents: { type: :integer }
            },
            required: %w[id name charged_per required quantity amount_cents total_cents]
          },
          # One room of a stay's quote (RAA-182): its guests, and its price as a stay of one room.
          stay_quote_room: {
            type: :object,
            properties: {
              adults: { type: :integer },
              children: { type: :integer },
              infants: { type: :integer, description: "Free, and in a bed only if the place counts them" },
              nightly_subtotal_cents: { type: :integer },
              extra_guests: { type: :integer, description: "Adults and children above base_guests" },
              extra_guests_total_cents: { type: :integer },
              discount: { "$ref" => "#/components/schemas/stay_discount" },
              fees: { type: :array, items: { "$ref" => "#/components/schemas/stay_fee_line" } },
              total_cents: { type: :integer }
            },
            required: %w[adults children infants nightly_subtotal_cents extra_guests extra_guests_total_cents discount fees
              total_cents]
          },
          listing_fee_body: {
            type: :object,
            properties: {
              name: { type: :string, maxLength: 60 },
              amount_cents: { type: :integer, minimum: 0 },
              charged_per: { "$ref" => "#/components/schemas/listing_fee_charged_per" },
              required: { type: :boolean, description: "Default true" }
            },
            required: %w[name amount_cents charged_per]
          },
          photo_upload_body: {
            type: :object,
            properties: {
              filename: { type: :string, maxLength: 255 },
              byte_size: { type: :integer, minimum: 1, maximum: 10_485_760 },
              checksum: { type: :string, description: "The file's MD5 digest, base64-encoded" },
              content_type: { type: :string, enum: %w[image/jpeg image/png image/webp] }
            },
            required: %w[filename byte_size checksum content_type]
          },
          # Where the browser sends a photo's bytes (RAA-106): storage, not this API.
          photo_upload: {
            type: :object,
            properties: {
              id: { type: :integer, description: "The photo's id, to confirm the upload and in a listing's photos" },
              upload: {
                type: :object,
                properties: {
                  url: { type: :string, description: "PUT the file's bytes here" },
                  headers: {
                    type: :object, additionalProperties: { type: :string },
                    description: "Send exactly these headers with the PUT"
                  }
                },
                required: %w[url headers]
              }
            },
            required: %w[id upload]
          },
          photo_update_body: {
            type: :object,
            properties: { uploaded: { type: :boolean, enum: [ true ] } },
            required: %w[uploaded]
          },
          # What a listing includes and how big it is, from its attrs (RAA-124); never a plate or
          # serial number. Free-form like a partner's attrs, as each category has its own keys.
          listing_details: {
            type: :object,
            additionalProperties: true,
            description: "Only the keys the listing has, from: guide_included, seats, luggage (bags a transfer " \
              "carries), route, sizes, accessories, lenses, engine_cc, transmission, guests (how many a stay " \
              "sleeps), rooms ([{beds: [{type, count}]}]), bathroom, amenities (a stay's or a vehicle's), place_type"
          },
          # What a guest gets back on cancelling (RAA-88); refunds follow it from M4.
          cancellation_policy: {
            type: :string, enum: %w[free_cancellation non_refundable seven_days fourteen_days],
            description: "free_cancellation: free any time before the booking starts; non_refundable: no refund; " \
              "seven_days / fourteen_days: free up to 7 / 14 days before it starts, non-refundable after"
          },
          # How guests book a listing (RAA-132).
          booking_mode: {
            type: :string, enum: Listing::BOOKING_MODES.keys,
            description: "instant: guests book and pay at once; request: the partner accepts or declines within 24 hours, " \
              "the dates held meanwhile"
          },
          listing_options: {
            type: :object,
            properties: {
              booking_modes: {
                type: :array,
                description: "Every booking mode, in the order to offer them, with its wording for a partner",
                items: {
                  type: :object,
                  properties: {
                    value: { "$ref" => "#/components/schemas/booking_mode" },
                    name: { type: :string },
                    description: { type: :string }
                  },
                  required: %w[value name description]
                }
              },
              cancellation_policies: {
                type: :array,
                description: "Every cancellation policy, in the order to offer them, with its wording for a partner",
                items: {
                  type: :object,
                  properties: {
                    value: { "$ref" => "#/components/schemas/cancellation_policy" },
                    name: { type: :string },
                    description: { type: :string }
                  },
                  required: %w[value name description]
                }
              },
              tour_inclusions: {
                type: :array,
                description: "What a tour can include (RAA-110), each kind with the options it takes, in order",
                items: {
                  type: :object,
                  properties: {
                    kind: { type: :string, enum: %w[accommodation transport meal] },
                    options: { type: :array, items: { type: :string } }
                  },
                  required: %w[kind options]
                }
              },
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
                    description: { type: :string, description: "What the category means, for a partner choosing one" },
                    attribute_schema: {
                      type: :object, additionalProperties: true,
                      description: "The JSON Schema a listing's attrs must match"
                    }
                  },
                  required: %w[id slug name booking_type parent_name description attribute_schema]
                }
              }
            },
            required: %w[categories cancellation_policies booking_modes tour_inclusions]
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
              to_book_count: {
                type: :integer,
                description: "What the area's page counts to book: one per business per guest group, the areas inside it included"
              },
              activities: { type: :array, items: { "$ref" => "#/components/schemas/tag" } }
            },
            required: %w[slug name kind parent_name parent_slug landmark_count listing_count to_book_count activities]
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
                    tags: { type: :array, items: { "$ref" => "#/components/schemas/tag" } },
                    visited_by: {
                      type: :array, items: { type: :integer },
                      description: "The ids of the active listings that visit it, from the listings here"
                    }
                  },
                  required: %w[slug name description tags visited_by]
                }
              },
              listings: {
                description: "What to book here and in the published places inside it, however deep",
                type: :array,
                items: {
                  type: :object,
                  description: "A listing summary plus its booking type, summary and partner; no location",
                  properties: {
                    id: { type: :integer },
                    title: { type: :string },
                    category: { type: :string },
                    group: LISTING_GROUP,
                    area_slug: { type: :string },
                    area_name: { type: :string, description: "Its own place: this area or one inside it" },
                    instant_book: { type: :boolean, description: "Booked at once, without asking the partner (RAA-132)" },
                    cover_photo_url: COVER_PHOTO_URL,
                    booking_type: { type: :string, enum: %w[rental stay activity transfer] },
                    summary: { type: :string, description: "As in listing_detail" },
                    business: { "$ref" => "#/components/schemas/business_ref" },
                    units_count: { type: :integer, minimum: 1 },
                    units_label: { type: :string, description: "As in listing_detail" },
                    partner_name: { type: :string, deprecated: true, description: "As in listing_detail" },
                    price_from_cents: { type: :integer, nullable: true, description: "As in listing_detail" },
                    price_unit: { "$ref" => "#/components/schemas/price_unit" },
                    photos: {
                      type: :array, maxItems: 6, items: { "$ref" => "#/components/schemas/photo_urls" },
                      description: "Its first ready photos, in the partner's order"
                    },
                    details: { "$ref" => "#/components/schemas/listing_details" },
                    tour: {
                      type: :object, nullable: true, description: "A tour's kind and the group it takes; null for anything else",
                      properties: {
                        tour_type: { "$ref" => "#/components/schemas/tour_type" },
                        min_guests: { type: :integer, minimum: 1 },
                        max_guests: { type: :integer, minimum: 1 }
                      },
                      required: %w[tour_type min_guests max_guests]
                    },
                    cancellation_policy: { "$ref" => "#/components/schemas/cancellation_policy" }
                  },
                  required: %w[id title category group area_slug area_name instant_book cover_photo_url booking_type summary business units_count units_label
                    partner_name price_from_cents price_unit photos details tour cancellation_policy]
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
              landmark_count: { type: :integer },
              # Active listings in bookable areas whose category carries the tag.
              listing_count: { type: :integer }
            },
            required: %w[slug name area_count landmark_count listing_count]
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
              group: LISTING_GROUP,
              area_slug: { type: :string },
              instant_book: { type: :boolean, description: "Booked at once, without asking the partner (RAA-132)" },
              cover_photo_url: COVER_PHOTO_URL,
              location: { "$ref" => "#/components/schemas/lat_lng" },
              booking_type: { type: :string, enum: %w[rental stay activity transfer] },
              price_from_cents: {
                type: :integer, nullable: true,
                description: "A stay's nightly price or a tour's base price, in centavos; null with no price yet or for any other category"
              },
              price_unit: { "$ref" => "#/components/schemas/price_unit" },
              distance_km: { type: :number, description: "From the starting point's exact point, one decimal" }
            },
            required: %w[id title category group area_slug instant_book cover_photo_url location booking_type price_from_cents price_unit distance_km]
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
          },
          # The partner calendar (RAA-118). Money is in centavos; dates are ISO 8601.
          partner_calendar: {
            type: :object,
            properties: {
              from: { type: :string, format: :date },
              to: { type: :string, format: :date },
              listings: {
                type: :array, items: { "$ref" => "#/components/schemas/calendar_listing" },
                description: "Every listing of the partner's, by business, category and title"
              }
            },
            required: %w[from to listings]
          },
          calendar_listing: {
            type: :object,
            properties: {
              id: { type: :integer },
              title: { type: :string },
              status: { type: :string, enum: Listing::STATUSES },
              business: {
                type: :object, properties: { id: { type: :integer }, name: { type: :string } }, required: %w[id name]
              },
              category: {
                type: :object,
                properties: {
                  id: { type: :integer }, slug: { type: :string }, name: { type: :string },
                  booking_type: { type: :string, enum: Category::BOOKING_TYPES }
                },
                required: %w[id slug name booking_type]
              },
              tour_type: {
                type: :string, nullable: true, enum: [ *TourDetail::TOUR_TYPES, nil ],
                description: "A tour's type (a joiner tour sells seats); null for anything else"
              },
              capacity: {
                type: :integer,
                description: "What a day can sell at most: a joiner tour's seats, a private tour's groups, otherwise its units"
              },
              capacity_unit: {
                type: :string, enum: %w[units groups seats],
                description: "What capacity, units on sale and a booking's quantity count"
              },
              price_unit: { "$ref" => "#/components/schemas/price_unit" },
              days: { type: :array, items: { "$ref" => "#/components/schemas/calendar_day" } },
              blocks: {
                type: :array, items: { "$ref" => "#/components/schemas/availability_block" },
                description: "Blocks touching the window"
              },
              bookings: {
                type: :array, items: { "$ref" => "#/components/schemas/booking" },
                description: "Confirmed bookings touching the window"
              }
            },
            required: %w[id title status business category tour_type capacity capacity_unit price_unit days blocks bookings]
          },
          calendar_day: {
            type: :object,
            properties: {
              date: { type: :string, format: :date },
              price_cents: {
                type: :integer, nullable: true,
                description: "The day's own price, else the listing's (a stay's weekend price on Friday and Saturday); " \
                  "null while the listing has none"
              },
              price_set: { type: :boolean, description: "Whether the price is the day's own" },
              units_available: {
                type: :integer, description: "Units on sale that day (a private tour's groups, a joiner tour's seats)"
              },
              units_set: { type: :boolean, description: "Whether units_available is the day's own" },
              booked: { type: :integer, description: "Units taken by confirmed bookings" },
              units_left: { type: :integer, description: "What can still be booked: 0 when blocked or sold out" },
              min_nights: {
                type: :integer, nullable: true,
                description: "A stay's minimum nights checking in that day; null for anything else"
              },
              min_nights_set: { type: :boolean, description: "Whether min_nights is the day's own" },
              block_id: { type: :integer, nullable: true, description: "The block covering the day, if any" }
            },
            required: %w[date price_cents price_set units_available units_set booked units_left min_nights
              min_nights_set block_id]
          },
          calendar_days_body: {
            type: :object,
            description: "Send any of price_cents, units_available and min_nights; null puts back the listing's own, " \
              "and a key left out stays as it is",
            properties: {
              starts_on: { type: :string, format: :date, description: "Today or later" },
              ends_on: { type: :string, format: :date, description: "At most 366 days from starts_on" },
              price_cents: { type: :integer, nullable: true, minimum: 1, maximum: Availability::SetDays::MAX_PRICE_CENTS },
              units_available: {
                type: :integer, nullable: true, minimum: 0,
                description: "Up to the listing's capacity, and never below what is booked on any of the days"
              },
              min_nights: { type: :integer, nullable: true, minimum: 1, maximum: 365, description: "Stays only" }
            },
            required: %w[starts_on ends_on]
          },
          availability_block: {
            type: :object,
            properties: {
              id: { type: :integer },
              starts_on: { type: :string, format: :date },
              ends_on: { type: :string, format: :date, description: "Included" },
              reason: { type: :string, nullable: true }
            },
            required: %w[id starts_on ends_on reason]
          },
          availability_block_body: {
            type: :object,
            properties: {
              starts_on: { type: :string, format: :date },
              ends_on: {
                type: :string, format: :date,
                description: "Included; today or later, at most 366 days from starts_on. A block can't overlap another."
              },
              reason: { type: :string, nullable: true, maxLength: AvailabilityBlock::REASON_LENGTH }
            },
            required: %w[starts_on ends_on]
          },
          booking: {
            type: :object,
            properties: {
              id: { type: :integer },
              reference: { type: :string, description: "A short code the guest and the partner can quote" },
              guest_name: { type: :string },
              guest_email: { type: :string, nullable: true, description: "Null for one taken offline" },
              guest_phone: { type: :string, nullable: true, description: "Null for one taken offline" },
              starts_on: { type: :string, format: :date },
              ends_on: {
                type: :string, format: :date,
                description: "A stay's check-out (it takes the nights before); otherwise the last day it takes"
              },
              quantity: { type: :integer, description: "Units, a private tour's groups or a joiner tour's joiners" },
              guests: { type: :integer, nullable: true, description: "Null for one taken offline" },
              status: { "$ref" => "#/components/schemas/booking_status" },
              source: { type: :string, enum: Booking::SOURCES, description: "offline: taken by the partner outside the app" },
              booking_mode: {
                type: :string, enum: Booking::BOOKING_MODES, nullable: true,
                description: "The listing's when it was booked; null for one taken offline"
              },
              total_cents: { type: :integer },
              to_be_agreed: { type: :boolean, description: "Not priced in the app yet (rentals, transfers): settled with the guest" },
              commission_cents: { type: :integer, description: "The platform's share of the total" },
              refund_cents: { type: :integer, nullable: true, description: "What the guest got back on cancelling" },
              cancelled_by: { type: :string, enum: Booking::CANCELLED_BY, nullable: true },
              expires_at: {
                type: :string, format: "date-time", nullable: true,
                description: "When a pending booking expires unless answered (a request) or paid (a hold)"
              },
              notes: { type: :string },
              listing: {
                type: :object,
                properties: { id: { type: :integer }, title: { type: :string } },
                required: %w[id title]
              },
              created_at: { type: :string, format: "date-time" }
            },
            required: %w[id reference guest_name guest_email guest_phone starts_on ends_on quantity guests status source
              booking_mode total_cents to_be_agreed commission_cents refund_cents cancelled_by expires_at notes listing
              created_at]
          },
          # The booking lifecycle (RAA-132).
          booking_status: {
            type: :string, enum: Booking::STATUSES,
            description: "requested → accepted → awaiting_payment → confirmed → in_progress → completed; instant book " \
              "starts at awaiting_payment. declined, cancelled and expired free the days; the others hold them"
          },
          booking_ref: {
            type: :object,
            properties: {
              id: { type: :integer },
              reference: { type: :string },
              status: { "$ref" => "#/components/schemas/booking_status" },
              total_cents: { type: :integer, description: "What it was booked for, in centavos" },
              to_be_agreed: { type: :boolean, description: "Priced with the partner: total_cents is 0" },
              expires_at: {
                type: :string, format: "date-time", nullable: true,
                description: "Answer-by time of a request, pay-by time of one awaiting payment (RAA-143)"
              }
            },
            required: %w[id reference status total_cents to_be_agreed expires_at]
          },
          booking_event: {
            type: :object,
            properties: {
              from_status: { allOf: [ { "$ref" => "#/components/schemas/booking_status" } ], nullable: true },
              to_status: { "$ref" => "#/components/schemas/booking_status" },
              actor: { type: :string, enum: BookingEvent::ACTORS },
              reason: { type: :string, nullable: true },
              created_at: { type: :string, format: "date-time" }
            },
            required: %w[from_status to_status actor reason created_at]
          },
          # A guest's booking (RAA-132). Never the listing's location.
          # A booking as the team sees it when answering for its partner (RAA-141).
          admin_booking: {
            type: :object,
            properties: {
              id: { type: :integer },
              reference: { type: :string },
              guest_name: { type: :string },
              guest_email: { type: :string, nullable: true, description: "Null for one taken offline" },
              guest_phone: { type: :string, nullable: true, description: "Null for one taken offline" },
              starts_on: { type: :string, format: :date },
              ends_on: {
                type: :string, format: :date,
                description: "A stay's check-out (it takes the nights before); otherwise the last day it takes"
              },
              quantity: { type: :integer, description: "Units, a private tour's groups or a joiner tour's joiners" },
              guests: { type: :integer, nullable: true, description: "Null for one taken offline" },
              status: { "$ref" => "#/components/schemas/booking_status" },
              source: { type: :string, enum: Booking::SOURCES, description: "offline: taken by the partner outside the app" },
              booking_mode: { type: :string, enum: Booking::BOOKING_MODES, nullable: true },
              booking_type: { type: :string, enum: Category::BOOKING_TYPES, nullable: true },
              total_cents: { type: :integer },
              to_be_agreed: { type: :boolean, description: "Not priced in the app yet (rentals, transfers): settled with the guest" },
              commission_cents: { type: :integer, description: "The platform's share of the total" },
              refund_cents: { type: :integer, nullable: true },
              cancelled_by: { type: :string, enum: Booking::CANCELLED_BY, nullable: true },
              cancellation_policy: {
                allOf: [ { "$ref" => "#/components/schemas/cancellation_policy" } ], nullable: true,
                description: "The listing's when it was booked"
              },
              expires_at: {
                type: :string, format: "date-time", nullable: true,
                description: "When a request expires unless answered, or an unpaid hold unless paid"
              },
              responded_at: { type: :string, format: "date-time", nullable: true },
              notes: { type: :string, nullable: true },
              listing: {
                type: :object,
                properties: { id: { type: :integer }, title: { type: :string }, area: { type: :string } },
                required: %w[id title area]
              },
              partner: {
                type: :object,
                properties: {
                  id: { type: :integer },
                  name: { type: :string, nullable: true },
                  email: { type: :string },
                  phone: { type: :string, nullable: true },
                  business: { type: :string, description: "The listing's business, the name travellers see" }
                },
                required: %w[id name email phone business]
              },
              traveller: {
                type: :object, nullable: true,
                description: "Null for one taken offline (see guest_name). As the booking keeps them: id is null once " \
                  "an unregistered guest's account is deleted",
                properties: {
                  id: { type: :integer, nullable: true },
                  name: { type: :string },
                  email: { type: :string, nullable: true },
                  phone: { type: :string, nullable: true }
                },
                required: %w[id name email phone]
              },
              created_at: { type: :string, format: "date-time" }
            },
            required: %w[id reference guest_name guest_email guest_phone starts_on ends_on quantity guests status source
              booking_mode booking_type
              total_cents to_be_agreed commission_cents refund_cents cancelled_by cancellation_policy expires_at
              responded_at notes listing partner traveller created_at]
          },
          guest_booking: {
            type: :object,
            properties: {
              id: { type: :integer },
              reference: { type: :string },
              status: { "$ref" => "#/components/schemas/booking_status" },
              booking_mode: { type: :string, enum: Booking::BOOKING_MODES, nullable: true },
              starts_on: { type: :string, format: :date },
              ends_on: { type: :string, format: :date, description: "A stay's check-out; otherwise the last day" },
              quantity: { type: :integer },
              guests: { type: :integer, nullable: true },
              room_guests: ROOM_GUESTS,
              pets: { type: :integer, description: "A stay's pets (RAA-182)" },
              total_cents: { type: :integer },
              to_be_agreed: { type: :boolean, description: "Not priced in the app yet (rentals, transfers): settled with the partner" },
              cancellation_policy: {
                allOf: [ { "$ref" => "#/components/schemas/cancellation_policy" } ], nullable: true,
                description: "The listing's when it was booked"
              },
              expires_at: { type: :string, format: "date-time", nullable: true },
              confirmed_at: { type: :string, format: "date-time", nullable: true },
              cancelled_at: { type: :string, format: "date-time", nullable: true },
              cancelled_by: { type: :string, enum: Booking::CANCELLED_BY, nullable: true },
              refund_cents: { type: :integer, nullable: true },
              cancellable: { type: :boolean, description: "It hasn't started, and isn't over or cancelled" },
              refund_if_cancelled_cents: {
                type: :integer, nullable: true,
                description: "What the guest would get back cancelling now, by its cancellation policy; null when not cancellable"
              },
              free_cancellation_until: {
                type: :string, format: :date, nullable: true,
                description: "The last day the guest can cancel for a full refund, by its cancellation policy (RAA-135); " \
                  "null when the policy refunds nothing"
              },
              trip_id: { type: :integer, nullable: true },
              trip_item_id: { type: :integer, nullable: true },
              booking_type: { type: :string, enum: %w[rental stay activity transfer] },
              area: { "$ref" => "#/components/schemas/area_ref" },
              listing: { "$ref" => "#/components/schemas/listing_summary" },
              created_at: { type: :string, format: "date-time" },
              events: {
                type: :array, items: { "$ref" => "#/components/schemas/booking_event" },
                description: "Its history, oldest first"
              }
            },
            required: %w[id reference status booking_mode starts_on ends_on quantity guests room_guests pets total_cents to_be_agreed
              cancellation_policy expires_at confirmed_at cancelled_at cancelled_by refund_cents cancellable
              refund_if_cancelled_cents free_cancellation_until trip_id trip_item_id booking_type area listing created_at events]
          },
          checkout_body: {
            type: :object,
            properties: {
              trip_id: { type: :integer },
              item_ids: {
                type: :array, items: { type: :integer }, minItems: 1, maxItems: Checkouts::Create::MAX_ITEMS,
                description: "The trip's items to book, each dated and not booked already"
              },
              idempotency_key: {
                type: :string, minLength: Checkouts::Create::KEY_LENGTH.min, maxLength: Checkouts::Create::KEY_LENGTH.max,
                description: "Made by the client for this checkout; sent again, it returns the same checkout"
              },
              contact: {
                type: :object,
                description: "Required from a guest without an email yet (their first checkout); ignored otherwise. " \
                  "Partners see these on each booking. An email another guest has answers 409 and emails it a code " \
                  "(POST /api/v1/sign_in_codes/verify)",
                properties: { name: { type: :string }, email: { type: :string }, phone: { type: :string } },
                required: %w[name email phone]
              }
            },
            required: %w[trip_id item_ids idempotency_key]
          },
          checkout: {
            type: :object,
            properties: {
              id: { type: :integer },
              trip_id: { type: :integer, nullable: true },
              total_cents: { type: :integer },
              bookings: { type: :array, items: { "$ref" => "#/components/schemas/guest_booking" } },
              trip_link: {
                type: :object, nullable: true,
                description: "Only on an unregistered guest's first checkout, and never again: the trip link's token " \
                  "(the web app's /trips/open/<token>) and its PIN. Also emailed",
                properties: { token: { type: :string }, pin: { type: :string, pattern: "^[0-9]{6}$" } },
                required: %w[token pin]
              }
            },
            required: %w[id trip_id total_cents bookings trip_link]
          },
          # A guest's trip link and PIN (RAA-175), shown once.
          trip_link: {
            type: :object,
            properties: {
              token: { type: :string, description: "The web app's trip link is /trips/open/<token>" },
              pin: { type: :string, pattern: "^[0-9]{6}$" }
            },
            required: %w[token pin]
          },
          # The bookings a guest pays for at once (RAA-143).
          booking_pay_body: {
            type: :object,
            required: %w[booking_ids],
            properties: { booking_ids: { type: :array, items: { type: :integer }, minItems: 1 } }
          },
          # A guest's payment (PaymentSerializer); PayMongo's checkout runs in test mode only.
          payment: {
            type: :object,
            properties: {
              id: { type: :integer },
              status: { type: :string, enum: Payment::STATUSES,
                        description: "needs_refund: paid after its bookings were let go (refunded by the team)" },
              amount_cents: { type: :integer },
              checkout_url: { type: :string, nullable: true,
                              description: "PayMongo's page to pay on, while pending; the guest comes back to /cart?payment=<id>" },
              test_mode: { type: :boolean, description: "A PayMongo test payment: no real money moves" },
              paid_at: { type: :string, format: "date-time", nullable: true }
            },
            required: %w[id status amount_cents checkout_url test_mode paid_at]
          },
          booking_pay_result: {
            type: :object,
            properties: {
              bookings: { type: :array, items: { "$ref" => "#/components/schemas/guest_booking" } },
              payment: {
                allOf: [ { "$ref" => "#/components/schemas/payment" } ], nullable: true,
                description: "The payment to finish on PayMongo's checkout_url; null when nothing was charged " \
                  "(no PayMongo set up, or only bookings paid already or priced at nothing)"
              }
            },
            required: %w[bookings payment]
          },
          payment_with_bookings: {
            type: :object,
            properties: {
              id: { type: :integer },
              status: { type: :string, enum: Payment::STATUSES },
              amount_cents: { type: :integer },
              checkout_url: { type: :string, nullable: true },
              test_mode: { type: :boolean },
              paid_at: { type: :string, format: "date-time", nullable: true },
              bookings: { type: :array, items: { "$ref" => "#/components/schemas/guest_booking" } }
            },
            required: %w[id status amount_cents checkout_url test_mode paid_at bookings]
          },
          booking_cancel_body: {
            type: :object,
            properties: { reason: { type: :string, maxLength: Booking::REASON_LENGTH } }
          },
          # A guest's change to a booking (RAA-134); a key left out keeps what the booking has.
          booking_change_body: {
            type: :object,
            properties: {
              starts_on: { type: :string, format: :date, description: "Today or later; a stay's check-in" },
              ends_on: { type: :string, format: :date, description: "A stay's check-out; otherwise the last day" },
              guests: { type: :integer, minimum: 1, maximum: Bookings::Change::MAX_GUESTS }
            }
          },
          offline_booking_body: {
            type: :object,
            properties: {
              guest_name: { type: :string, maxLength: Booking::GUEST_NAME_LENGTH },
              starts_on: { type: :string, format: :date, description: "Today or later; a stay's check-in" },
              ends_on: { type: :string, format: :date, description: "A stay's check-out; otherwise the last day" },
              quantity: { type: :integer, minimum: 1, maximum: Booking::MAX_QUANTITY },
              total_cents: { type: :integer, minimum: 0, description: "What the guest pays the partner" },
              notes: { type: :string, maxLength: Booking::NOTES_LENGTH }
            },
            required: %w[guest_name starts_on ends_on quantity total_cents]
          },
          booking_status_body: {
            type: :object,
            properties: {
              status: {
                type: :string, enum: Bookings::ChangeStatus::STATUSES,
                description: "accepted / declined answer a request; cancelled refunds the guest in full"
              },
              reason: { type: :string, maxLength: Booking::REASON_LENGTH, description: "Why it was cancelled" }
            },
            required: %w[status]
          },
          # A destination in the admin console's list (RAA-164).
          admin_area_row: {
            type: :object,
            properties: {
              slug: { type: :string },
              name: { type: :string },
              kind: { type: :string, enum: Area::KINDS },
              status: { type: :string, enum: Area::STATUSES },
              parent: { allOf: [ { "$ref" => "#/components/schemas/area_ref" } ], nullable: true },
              listing_count: { type: :integer, description: "Active listings in the area itself" },
              landmark_count: { type: :integer, description: "Published landmarks in the area itself" },
              **SEED_RUN
            },
            required: %w[slug name kind status parent listing_count landmark_count seed_status seeded_at seed_report]
          },
          # The banner's sizes and state; until it is ready both URLs are the original's.
          area_banner_photo: {
            type: :object,
            properties: {
              uploaded: { type: :boolean },
              ready: { type: :boolean },
              card_url: { type: :string },
              large_url: { type: :string }
            },
            required: %w[uploaded ready card_url large_url]
          },
          # A destination as the admin console edits it (RAA-164).
          admin_area: {
            type: :object,
            properties: {
              slug: { type: :string },
              name: { type: :string },
              kind: { type: :string, enum: Area::KINDS },
              status: { type: :string, enum: Area::STATUSES },
              parent: { allOf: [ { "$ref" => "#/components/schemas/area_ref" } ], nullable: true },
              aliases: { type: :array, items: { type: :string } },
              center: {
                type: :object,
                properties: { lat: { type: :number }, lng: { type: :number } },
                required: %w[lat lng]
              },
              psgc_code: { type: :string, nullable: true },
              tagline: { type: :string },
              description: { type: :string },
              getting_there: { type: :string },
              best_time_to_visit: { type: :string },
              tags: { type: :array, items: { "$ref" => "#/components/schemas/tag" } },
              banner_photo: { allOf: [ { "$ref" => "#/components/schemas/area_banner_photo" } ], nullable: true },
              wikidata_id: { type: :string, nullable: true },
              wikidata_aliases: {
                type: :array, items: { type: :string },
                description: "Read-only: filled by `bin/rails gazetteer:wikidata`"
              },
              wikidata_popularity: { type: :integer, description: "Read-only, as wikidata_aliases" },
              has_boundary: {
                type: :boolean,
                description: "Read-only: whether the gazetteer gave it a boundary, which places listings in it"
              },
              listing_count: { type: :integer },
              landmark_count: { type: :integer },
              **SEED_RUN
            },
            required: %w[slug name kind status parent aliases center psgc_code tagline description getting_there
              best_time_to_visit tags banner_photo wikidata_id wikidata_aliases wikidata_popularity has_boundary
              listing_count landmark_count seed_status seeded_at seed_report]
          },
          admin_area_body: {
            type: :object,
            description: "On a change, a field left out is kept. name, slug, kind and center are required on a new one.",
            properties: {
              name: { type: :string, maxLength: 120 },
              slug: { type: :string, description: "Lowercase letters, digits and single dashes; unique; not reserved" },
              kind: { type: :string, enum: Area::KINDS },
              status: {
                type: :string, enum: Area::STATUSES,
                description: "published also publishes every area above it; draft is refused while the area has " \
                  "active listings or published areas inside it"
              },
              parent_slug: { type: :string, nullable: true, description: "The area it sits in; null for none" },
              aliases: { type: :array, items: { type: :string, maxLength: 60 }, maxItems: 20 },
              center: {
                type: :object,
                properties: {
                  lat: { type: :number, minimum: -90, maximum: 90 },
                  lng: { type: :number, minimum: -180, maximum: 180 }
                },
                required: %w[lat lng]
              },
              psgc_code: { type: :string, nullable: true, description: "10 digits" },
              tagline: { type: :string, maxLength: 120 },
              description: { type: :string, maxLength: 5000 },
              getting_there: { type: :string, maxLength: 2000 },
              best_time_to_visit: { type: :string, maxLength: 200 },
              tag_slugs: { type: :array, items: { type: :string }, description: "Replaces the area's tags" },
              wikidata_id: {
                type: :string, nullable: true,
                description: "Like Q123. Changing it clears wikidata_aliases and wikidata_popularity until the next " \
                  "`bin/rails gazetteer:wikidata`"
              }
            }
          },
          admin_area_options: {
            type: :object,
            properties: {
              kinds: { type: :array, items: { type: :string, enum: Area::KINDS } },
              tags: { type: :array, items: { "$ref" => "#/components/schemas/tag" } }
            },
            required: %w[kinds tags]
          },
          # A landmark (place to see) in the admin console's list.
          admin_landmark_row: {
            type: :object,
            properties: {
              slug: { type: :string },
              name: { type: :string },
              status: { type: :string, enum: Landmark::STATUSES },
              area: { "$ref" => "#/components/schemas/area_ref" },
              visit_count: { type: :integer, description: "Listings that visit it" }
            },
            required: %w[slug name status area visit_count]
          },
          # A landmark as the admin console edits it.
          admin_landmark: {
            type: :object,
            properties: {
              slug: { type: :string },
              name: { type: :string },
              status: { type: :string, enum: Landmark::STATUSES },
              area: { "$ref" => "#/components/schemas/area_ref" },
              visit_count: { type: :integer },
              description: { type: :string },
              aliases: { type: :array, items: { type: :string } },
              location: {
                type: :object,
                properties: { lat: { type: :number }, lng: { type: :number } },
                required: %w[lat lng]
              },
              tags: { type: :array, items: { "$ref" => "#/components/schemas/tag" } },
              wikidata_id: { type: :string, nullable: true, description: "Read-only, set by `bin/rails gazetteer:wikidata`" },
              wikidata_aliases: { type: :array, items: { type: :string }, description: "Read-only, as wikidata_id" },
              wikidata_popularity: { type: :integer, description: "Read-only, as wikidata_id" }
            },
            required: %w[slug name status area visit_count description aliases location tags wikidata_id
              wikidata_aliases wikidata_popularity]
          },
          admin_landmark_body: {
            type: :object,
            description: "On a change, a field left out is kept. name, slug and location are required on a new one. " \
              "The area is never sent: it is the one serving the pin.",
            properties: {
              name: { type: :string, maxLength: 120 },
              slug: { type: :string, description: "Lowercase letters, digits and single dashes; unique" },
              status: { type: :string, enum: Landmark::STATUSES },
              description: { type: :string, maxLength: 5000 },
              aliases: { type: :array, items: { type: :string, maxLength: 60 }, maxItems: 20 },
              location: {
                type: :object,
                properties: {
                  lat: { type: :number, minimum: -90, maximum: 90 },
                  lng: { type: :number, minimum: -180, maximum: 180 }
                },
                required: %w[lat lng]
              },
              tag_slugs: { type: :array, items: { type: :string }, description: "Replaces the landmark's tags" }
            }
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
