require "swagger_helper"

RSpec.describe "Partner listings", type: :request do
  path "/api/v1/partner/listings" do
    get "The signed-in partner's listings" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Every listing the partner owns, in any status, ordered by business name, then " \
        "category name, then title. The exact location is included: the reader owns the listing."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }

      response "200", "only the partner's own listings, by business, then category, then title" do
        schema type: :array, items: { "$ref" => "#/components/schemas/partner_listing" }

        let(:camera) { create(:category, name: "Action camera") }
        let(:tour) { create(:category, name: "Tour", booking_type: "activity") }
        let(:tours) { create(:business, partner: user, name: "Basilia Tours") }
        let(:gear) { create(:business, partner: user, name: "Basilia Gear") }

        before do
          create(:listing, partner: user, business: gear, category: tour, title: "Island hopping", status: "draft",
            location: "POINT(123.80 11.17)")
          create(:listing, partner: user, business: tours, category: camera, title: "Boat camera")
          create(:listing, partner: user, business: gear, category: camera, title: "Insta360 X4")
          create(:listing, partner: user, business: gear, category: camera, title: "GoPro Hero 12", status: "paused")
          create(:listing, category: camera, title: "Someone else's camera")
        end

        run_test! do |response|
          expect(response.parsed_body.pluck("title")).to eq([ "GoPro Hero 12", "Insta360 X4", "Island hopping", "Boat camera" ])
          expect(response.parsed_body.map { |row| row["business"]["name"] }.uniq).to eq([ "Basilia Gear", "Basilia Tours" ])
          tour_row = response.parsed_body[2]
          expect(tour_row).to include("status" => "draft", "location" => { "lat" => 11.17, "lng" => 123.80 })
          expect(tour_row["category"]).to include("name" => "Tour", "booking_type" => "activity")
        end
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

    post "Add a listing" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only. The listing is saved as a draft; any `status` sent is ignored. `attrs` is checked " \
        "against the category's `attribute_schema` (see `GET /api/v1/partner/listing_options`). The listing's area " \
        "is the smallest published city, town or island whose boundary covers the pin; failing that, the one " \
        "whose center is nearest the pin, within 50 km. The partner must have passed the ID check first " \
        "(`/api/v1/partner/verification`) and added a business (`/api/v1/partner/businesses`); until then it is a 403."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/listing_body" }

      let(:user) { create(:user, :partner, :id_verified, :business) }
      let(:Authorization) { bearer_for(user) }
      let!(:area) { create(:area, slug: "moalboal", name: "Moalboal", center: "POINT(123.396 9.945)") }
      let(:address) do
        { street: "Panagsama Beach", city: "Moalboal", province: "Cebu", region: "Central Visayas",
          postal_code: "6032", country: "PH" }
      end
      let(:category) do
        create(:category, name: "Tour", booking_type: "activity", attribute_schema: {
          type: "object",
          required: [ "guide_included" ],
          properties: { guide_included: { type: "boolean" }, duration_hours: { type: "number" } }
        })
      end
      let(:body) do
        { title: "Sardine run and turtle snorkel", description: "Half a day off Panagsama.",
          category_id: category.id, address: address, location: { lat: 9.95, lng: 123.37 },
          attrs: { guide_included: true, duration_hours: 4 } }
      end

      response "201", "saved as a draft, in the area nearest the pin" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before do
          body[:status] = "active"
          create(:area, slug: "cebu-city", name: "Cebu City", center: "POINT(123.891 10.316)")
          create(:area, slug: "cebu", name: "Cebu", kind: "province", center: "POINT(123.39 9.95)")
        end

        run_test! do |response|
          expect(response.parsed_body).to include(
            "title" => "Sardine run and turtle snorkel", "status" => "draft",
            "location" => { "lat" => 9.95, "lng" => 123.37 },
            "attrs" => { "guide_included" => true, "duration_hours" => 4 }, "cancellation_policy" => "free_cancellation",
            "booking_mode" => "request", "units_count" => 1
          )
          expect(response.parsed_body["area"]).to eq("slug" => "moalboal", "name" => "Moalboal")
          expect(response.parsed_body["address"]).to eq(address.stringify_keys)
          expect(user.listings.sole).to have_attributes(status: "draft", category: category, area: area)
        end
      end

      response "201", "in the smallest published area whose boundary covers the pin, before a nearer center" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before do
          create(:area, slug: "cebu", name: "Cebu", kind: "province", center: "POINT(123.85 10.45)",
            boundary: "MULTIPOLYGON(((123.3 9.4, 124.2 9.4, 124.2 11.4, 123.3 11.4, 123.3 9.4)))")
          create(:area, slug: "badian", name: "Badian", center: "POINT(123.39 9.87)",
            boundary: "MULTIPOLYGON(((123.30 9.80, 123.45 9.80, 123.45 10.00, 123.30 10.00, 123.30 9.80)))")
          create(:area, :draft, slug: "draft-town", name: "Draft Town", center: "POINT(123.37 9.95)",
            boundary: "MULTIPOLYGON(((123.36 9.94, 123.38 9.94, 123.38 9.96, 123.36 9.96, 123.36 9.94)))")
        end

        run_test! do |response|
          expect(response.parsed_body["area"]).to eq("slug" => "badian", "name" => "Badian")
        end
      end

      response "201", "a tour with the landmarks it visits, and the destinations they cover" do
        schema "$ref" => "#/components/schemas/partner_listing"

        let(:island) { create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island") }
        let(:kota) { create(:landmark, name: "Kota Beach", area: create(:area, name: "Santa Fe", parent: island)) }
        let(:kawasan) { create(:landmark, name: "Kawasan Falls", area: area) }

        before { body[:landmark_ids] = [ kota.id, kawasan.id, kota.id ] }

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("name")).to eq([ "Kawasan Falls", "Kota Beach" ])
          expect(response.parsed_body["landmarks"].last).to include(
            "id" => kota.id, "area" => { "slug" => kota.area.slug, "name" => "Santa Fe" },
            "destination" => { "slug" => "bantayan-island", "name" => "Bantayan Island" }
          )
          expect(response.parsed_body["covers"]).to eq([
            { "slug" => "bantayan-island", "name" => "Bantayan Island" }, { "slug" => "moalboal", "name" => "Moalboal" }
          ])
          expect(user.listings.sole.listing_landmarks.pluck(:relation)).to eq(%w[visits visits])
        end
      end

      response "422", "landmarks that aren't published, or unknown" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:landmark_ids] = [ create(:landmark, :draft).id, 0 ] }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Landmarks must be published landmarks")
          expect(Listing.count).to eq(0)
        end
      end

      response "422", "more than 30 landmarks" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:landmark_ids] = (1..31).to_a }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("A listing can visit at most 30 landmarks")
        end
      end

      response "422", "landmarks on a listing that isn't an activity" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before do
          body.merge!(category_id: create(:category, name: "Camera").id, attrs: {}, landmark_ids: [ create(:landmark).id ])
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Only tours and activities visit landmarks")
        end
      end

      response "201", "an address without a province" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before { body[:address] = address.merge(province: nil) }

        run_test! do |response|
          expect(response.parsed_body["address"]["province"]).to be_nil
        end
      end

      response "422", "a pin far from every destination" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:location] = { lat: 14.6, lng: 121.0 } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("No destination near this pin yet")
          expect(Listing.count).to eq(0)
        end
      end

      response "422", "attrs that don't match the category" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:attrs] = { duration_hours: "four" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to be_present
          expect(Listing.count).to eq(0)
        end
      end

      response "201", "with the cancellation policy the partner chose" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before { body[:cancellation_policy] = "seven_days" }

        run_test! do |response|
          expect(response.parsed_body["cancellation_policy"]).to eq("seven_days")
        end
      end

      response "422", "instant book, which isn't offered (RAA-134)" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:booking_mode] = "instant" }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Booking mode must be one of request")
        end
      end

      response "201", "with the number of identical units the partner has, one row each" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before { body[:units_count] = 3 }

        run_test! do |response|
          expect(response.parsed_body["units_count"]).to eq(3)
          expect(user.listings.sole.units.pluck(:position)).to eq([ 1, 2, 3 ])
        end
      end

      response "422", "a number of units that isn't a whole number from 1 to 100" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:units_count] = 101 }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Units must be a whole number from 1 to 100")
          expect(Listing.count).to eq(0)
        end
      end

      response "422", "photos on a new listing, which has none yet, or photos that aren't a list of ids" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:taken) { create_photo(create(:listing)) }

        before { body[:photos] = [ taken.id ] }

        run_test! do |refused|
          expect(refused.parsed_body["errors"]).to eq([ "Photos must be this listing's photos" ])
          expect(user.listings).to be_empty
          body[:photos] = [ "beach.jpg" ]
          post "/api/v1/partner/listings", params: body, as: :json, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["errors"]).to eq([ "Photos must be a list of photo ids" ])
        end
      end

      response "201", "under the partner's only business when business_id is left out" do
        schema "$ref" => "#/components/schemas/partner_listing"

        run_test! do |response|
          expect(response.parsed_body["business"]).to eq("id" => user.businesses.sole.id, "name" => "Moalboal Gear Rentals")
        end
      end

      response "201", "under the business the partner picked" do
        schema "$ref" => "#/components/schemas/partner_listing"

        let(:motors) { create(:business, partner: user, name: "Basilia Motor Rentals") }

        before { body[:business_id] = motors.id }

        run_test! { expect(user.listings.sole.business).to eq(motors) }
      end

      response "422", "business_id left out by a partner with several businesses" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { create(:business, partner: user, name: "Basilia Motor Rentals") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Business is required")
          expect(Listing.count).to eq(0)
        end
      end

      response "422", "another partner's business, or a business_id that isn't an id" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:business_id] = create(:business).id }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Business must be one of your businesses")
          body[:business_id] = "1"
          post "/api/v1/partner/listings", params: body, as: :json, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["errors"]).to include("Business must be one of your businesses")
          expect(Listing.count).to eq(0)
        end
      end

      response "422", "a cancellation policy we don't offer" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:cancellation_policy] = "thirty_days" }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Cancellation policy must be one of " \
            "free_cancellation, non_refundable, seven_days, fourteen_days")
        end
      end

      response "422", "a booking mode we don't offer" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:booking_mode] = "auction" }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Booking mode must be one of request")
        end
      end

      response "422", "a category that isn't bookable" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:category_id] = create(:category, :parent).id }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Category must be a bookable category")
        end
      end

      response "422", "an unknown category" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:category_id] = 0 }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Category is not one we know")
        end
      end

      response "422", "missing and wrong-typed values" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) do
          { title: 42, description: [ "x" ], category_id: "1", location: { lat: "9.95", lng: 200 }, attrs: "none",
            address: { street: "", city: 6032, province: 1, region: "Central Visayas" }, landmark_ids: [ "1" ],
            units_count: "3" }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(
            "Title is required", "Description must be text", "Category is required",
            "Street is required", "City is required", "Province must be text", "ZIP code is required",
            "Country is required",
            "Latitude must be a number between -90 and 90", "Longitude must be a number between -180 and 180",
            "Details must be an object", "Landmarks must be a list of landmark ids",
            "Units must be a whole number from 1 to 100"
          )
          expect(Listing.count).to eq(0)
        end
      end

      response "422", "a title or description too long" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body.merge!(title: "x" * 81, description: "x" * 2001) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(
            "Title is too long (maximum is 80 characters)", "Description is too long (maximum is 2000 characters)"
          )
        end
      end

      response "422", "an address that isn't an object" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:address] = "Panagsama Beach, Moalboal" }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Address must be an object")
        end
      end

      context "accommodation, priced by the night (RAA-104)" do
        let(:category) { create(:category, :accommodation) }
        let(:stay_rate) do
          { nightly_price_cents: 250_000, weekend_price_cents: 300_000, base_guests: 2, extra_guest_fee_cents: 50_000,
            weekly_discount_percent: 10, monthly_discount_percent: 20, min_nights: 2, max_nights: 30 }
        end

        before do
          body.merge!(title: "Kota Beach house", attrs: { place_type: "entire_place", guests: 4 }, stay_rate:)
        end

        response "201", "with its stay rate and fees" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before do
            body[:fees] = [
              { name: " Cleaning fee ", amount_cents: 80_000, charged_per: "booking" },
              { name: "Breakfast", amount_cents: 25_000, charged_per: "guest_night", required: false }
            ]
          end

          run_test! do |response|
            expect(response.parsed_body["stay_rate"]).to eq(stay_rate.stringify_keys)
            expect(response.parsed_body["fees"].map { _1.except("id") }).to eq([
              { "name" => "Cleaning fee", "amount_cents" => 80_000, "charged_per" => "booking", "required" => true },
              { "name" => "Breakfast", "amount_cents" => 25_000, "charged_per" => "guest_night", "required" => false }
            ])
          end
        end

        response "201", "a stay rate's optional fields left out take their defaults" do
          schema "$ref" => "#/components/schemas/partner_listing"

          let(:stay_rate) { { nightly_price_cents: 150_000 } }

          run_test! do |response|
            expect(response.parsed_body["stay_rate"]).to eq(
              "nightly_price_cents" => 150_000, "weekend_price_cents" => nil, "base_guests" => 1,
              "extra_guest_fee_cents" => 0, "weekly_discount_percent" => 0, "monthly_discount_percent" => 0,
              "min_nights" => 1, "max_nights" => nil
            )
            expect(response.parsed_body["fees"]).to eq([])
          end
        end

        context "with the real stay schema" do
          before(:all) { require Rails.root.join("db/migrate/20261027100100_add_stay_guest_rules").to_s }

          let(:category) do
            create(:category, :accommodation, attribute_schema: AddStayGuestRules::STAY_SCHEMA.deep_stringify_keys)
          end
          let(:rooms) { [ { beds: [ { type: "double", count: 2 } ] } ] }
          let(:attrs) do
            { place_type: "entire_place", guests: 4, rooms:, bathrooms: 1, children_count: false, infants_count: true, pets_allowed: true, max_pets: 2 }
          end

          before { body[:attrs] = attrs }

          response "201", "who takes a bed, and whether pets come and how many (RAA-185)" do
            schema "$ref" => "#/components/schemas/partner_listing"

            run_test! do |response|
              expect(response.parsed_body["attrs"]).to eq(attrs.deep_stringify_keys)
              expect(Listing.sole.attrs).to include("children_count" => false, "infants_count" => true, "max_pets" => 2)
            end
          end

          response "422", "guest rules of the wrong type, or more than 20 pets (RAA-185)" do
            schema "$ref" => "#/components/schemas/validation_errors"

            let(:attrs) { { place_type: "entire_place", guests: 4, rooms:, bathrooms: 1, children_count: "yes", pets_allowed: true, max_pets: 21 } }

            run_test! do |refused|
              expect(refused.parsed_body["errors"].size).to eq(2)
              body[:attrs] = attrs.merge(children_count: true, max_pets: 0)
              post "/api/v1/partner/listings", params: body, as: :json, headers: { "Authorization" => Authorization() }
              expect(response).to have_http_status(:unprocessable_content)
              expect(Listing.count).to eq(0)
            end
          end
        end

        response "422", "no stay rate" do
          schema "$ref" => "#/components/schemas/validation_errors"

          before { body.delete(:stay_rate) }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to include("Stay rate is required for accommodation")
            expect(Listing.count).to eq(0)
          end
        end

        response "422", "no nightly price, or one that isn't a whole number above 0, and wrong-typed fields" do
          schema "$ref" => "#/components/schemas/validation_errors"

          let(:stay_rate) { { nightly_price_cents: 0, base_guests: "2", max_nights: 1.5 } }

          run_test! do |refused|
            expect(refused.parsed_body["errors"]).to include(
              "Nightly price must be a whole number of centavos above 0",
              "Guests included in the price must be a whole number",
              "Maximum nights must be a whole number"
            )
            stay_rate.delete(:nightly_price_cents)
            post "/api/v1/partner/listings", params: body, as: :json, headers: { "Authorization" => Authorization() }
            expect(response.parsed_body["errors"]).to include("Nightly price must be a whole number of centavos above 0")
            expect(Listing.count).to eq(0)
          end
        end

        response "422", "a stay rate the place can't take" do
          schema "$ref" => "#/components/schemas/validation_errors"

          let(:stay_rate) { { nightly_price_cents: 150_000, base_guests: 5, min_nights: 3, max_nights: 2 } }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to include(
              "Guests included in the price can't be more than the 4 guests the place sleeps",
              "Maximum nights can't be fewer than the minimum nights"
            )
            expect(StayRate.count).to eq(0)
            expect(Listing.count).to eq(0)
          end
        end
      end

      context "a vehicle, priced by the day (RAA-149)" do
        let(:category) { create(:category, :motorcycle) }
        let(:vehicle_rate) do
          { daily_price_cents: 50_000, half_day_price_cents: 35_000, half_day_hours: 5, hourly_price_cents: 10_000,
            weekly_price_cents: 300_000, monthly_price_cents: 1_000_000, security_deposit_cents: 200_000,
            delivery_fee_cents: 0, return_pickup_fee_cents: 15_000, min_rental_days: 1, km_limit_per_day: 150,
            excess_km_fee_cents: 500 }
        end
        let(:attrs) do
          { make: "Honda", model: "Click 125", engine_cc: 125, transmission: "automatic", seats: 2,
            amenities: %w[rider_helmet raincoat phone_holder] }
        end

        before { body.merge!(title: "Honda Click 125 scooter", attrs:, vehicle_rate:) }

        response "201", "with its transmission, amenities, vehicle rate and per-day fees" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before do
            body[:fees] = [
              { name: "Passenger helmet", amount_cents: 5_000, charged_per: "day", required: false },
              { name: "Late return", amount_cents: 10_000, charged_per: "hour" }
            ]
          end

          run_test! do |response|
            expect(response.parsed_body["attrs"]).to eq(attrs.deep_stringify_keys)
            expect(response.parsed_body["vehicle_rate"])
              .to eq(vehicle_rate.stringify_keys.merge("driving" => "self_drive", "driver_fee_cents" => nil))
            expect(response.parsed_body["stay_rate"]).to be_nil
            expect(response.parsed_body["fees"].pluck("charged_per")).to eq(%w[day hour])
          end
        end

        response "201", "a vehicle rate's optional fields left out take their defaults" do
          schema "$ref" => "#/components/schemas/partner_listing"

          let(:vehicle_rate) { { daily_price_cents: 45_000 } }

          run_test! do |response|
            expect(response.parsed_body["vehicle_rate"]).to eq(
              "daily_price_cents" => 45_000, "half_day_price_cents" => nil, "half_day_hours" => 4,
              "hourly_price_cents" => nil, "weekly_price_cents" => nil, "monthly_price_cents" => nil,
              "security_deposit_cents" => 0, "delivery_fee_cents" => nil, "return_pickup_fee_cents" => nil,
              "min_rental_days" => 1, "km_limit_per_day" => nil, "excess_km_fee_cents" => nil,
              "driving" => "self_drive", "driver_fee_cents" => nil
            )
          end
        end

        response "201", "with the car amenities (RAA-150)" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before { attrs[:amenities] = %w[air_conditioning bluetooth_audio dashcam rfid_toll early_warning_device] }

          run_test! do |response|
            expect(response.parsed_body["attrs"]["amenities"]).to eq(attrs[:amenities])
          end
        end

        response "201", "a car with a driver, at a fee per day (RAA-150)" do
          schema "$ref" => "#/components/schemas/partner_listing"

          let(:category) { create(:category, :car) }

          before { vehicle_rate.merge!(driving: "either", driver_fee_cents: 150_000) }

          run_test! do |response|
            expect(response.parsed_body["vehicle_rate"]).to include("driving" => "either", "driver_fee_cents" => 150_000)
          end
        end

        response "422", "a choice of driver with no fee" do
          schema "$ref" => "#/components/schemas/validation_errors"

          let(:category) { create(:category, :car) }

          before { vehicle_rate.merge!(driving: "either") }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to include("Driver fee is required when the guest can choose a driver")
            expect(Listing.count).to eq(0)
          end
        end

        response "422", "no vehicle rate" do
          schema "$ref" => "#/components/schemas/validation_errors"

          before { body.delete(:vehicle_rate) }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to include("Vehicle rate is required for a vehicle rental")
            expect(Listing.count).to eq(0)
          end
        end

        response "422", "no transmission, and an amenity we don't know" do
          schema "$ref" => "#/components/schemas/validation_errors"

          before do
            attrs.delete(:transmission)
            attrs[:amenities] = %w[rider_helmet jetpack]
          end

          run_test! do |response|
            errors = response.parsed_body["errors"].join(" ")
            expect(errors).to include("transmission")
            expect(errors).to include("/amenities/1")
            expect(Listing.count).to eq(0)
          end
        end

        response "422", "no daily price, and wrong-typed fields" do
          schema "$ref" => "#/components/schemas/validation_errors"

          let(:vehicle_rate) { { daily_price_cents: 0, half_day_price_cents: "350", delivery_fee_cents: 1.5 } }

          run_test! do |refused|
            expect(refused.parsed_body["errors"]).to include(
              "Daily price must be a whole number of centavos above 0",
              "Half-day price must be a whole number",
              "Delivery fee must be a whole number"
            )
            vehicle_rate.delete(:daily_price_cents)
            post "/api/v1/partner/listings", params: body, as: :json, headers: { "Authorization" => Authorization() }
            expect(response.parsed_body["errors"]).to include("Daily price must be a whole number of centavos above 0")
            expect(Listing.count).to eq(0)
          end
        end

        response "422", "a vehicle rate whose longer rentals cost more per day" do
          schema "$ref" => "#/components/schemas/validation_errors"

          let(:vehicle_rate) { { daily_price_cents: 50_000, weekly_price_cents: 400_000, half_day_price_cents: 60_000 } }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to include(
              "Weekly price can't be more than 7 days at the daily price",
              "Half-day price must be less than the daily price"
            )
            expect(VehicleRate.count).to eq(0)
          end
        end
      end

      response "422", "a vehicle rate on a listing that isn't a vehicle" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:vehicle_rate] = { daily_price_cents: 50_000 } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Only a vehicle rental has a vehicle rate")
          expect(Listing.count).to eq(0)
        end
      end

      response "422", "a title shorter than 10 or longer than 80 characters" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:title] = "Snorkel" }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Title is too short (minimum is 10 characters)")
          expect(Listing.count).to eq(0)
        end
      end

      context "a tour, private or joiner (RAA-110)" do
        let(:category) { create(:category, :tour) }
        let(:tour) do
          { tour_type: "private", min_guests: 2, max_guests: 8, max_groups_per_day: 3, duration_value: 2,
            duration_unit: "days", base_price_cents: 900_000,
            inclusions: [
              { kind: "transport", options: %w[van boat], price_per_head_cents: 50_000 },
              { kind: "meal", options: %w[lunch snack], note: " Fresh seafood ", price_per_head_cents: 35_000 },
              { kind: "accommodation", note: "Beach cottage, 1 night", price_per_head_cents: 0 }
            ] }
        end

        before { body.merge!(attrs: { guide_included: true }, tour:) }

        response "201", "a private tour with priced inclusions" do
          schema "$ref" => "#/components/schemas/partner_listing"

          run_test! do |response|
            expect(response.parsed_body["tour"]).to eq(
              "tour_type" => "private", "min_guests" => 2, "max_guests" => 8, "max_groups_per_day" => 3,
              "duration_value" => 2, "duration_unit" => "days", "base_price_cents" => 900_000, "price_unit" => "group",
              "inclusions" => [
                { "kind" => "accommodation", "options" => [], "note" => "Beach cottage, 1 night", "price_per_head_cents" => 0 },
                { "kind" => "meal", "options" => %w[snack lunch], "note" => "Fresh seafood", "price_per_head_cents" => 35_000 },
                { "kind" => "transport", "options" => %w[van boat], "note" => nil, "price_per_head_cents" => 50_000 }
              ]
            )
            expect(response.parsed_body["photo_limit"]).to eq(5)
          end
        end

        response "201", "a joiner tour, its inclusions bundled in the price per head" do
          schema "$ref" => "#/components/schemas/partner_listing"

          # A client from before RAA-117 still sends a schedule; it is ignored.
          before do
            tour.merge!(tour_type: "joiner", weekdays: (0..6).to_a, dates: [], duration_value: 6, duration_unit: "hours",
              inclusions: [ { kind: "meal", options: %w[lunch] } ])
          end

          run_test! do |response|
            expect(response.parsed_body["tour"]).to include(
              "tour_type" => "joiner", "price_unit" => "person",
              "inclusions" => [ { "kind" => "meal", "options" => %w[lunch], "note" => nil, "price_per_head_cents" => 0 } ]
            )
            expect(response.parsed_body["tour"].keys).not_to include("weekdays", "dates")
          end
        end

        response "422", "a tour without tour details" do
          schema "$ref" => "#/components/schemas/validation_errors"

          before { body.delete(:tour) }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to include("Tour details are required for a tour")
            expect(Listing.count).to eq(0)
          end
        end

        response "422", "missing and wrong-typed tour details" do
          schema "$ref" => "#/components/schemas/validation_errors"

          let(:tour) do
            { tour_type: "both", min_guests: "2", max_groups_per_day: 0, duration_value: 1.5, duration_unit: "weeks",
              base_price_cents: 0, inclusions: {} }
          end

          run_test! do |refused|
            expect(refused.parsed_body["errors"]).to include(
              "Tour type must be private or joiner",
              "Minimum guests must be a whole number from 1 to 100",
              "Maximum guests must be a whole number from 1 to 100",
              "Groups per day must be a whole number from 1 to 100",
              "Duration must be a whole number",
              "Duration unit must be hours or days",
              "Base price must be a whole number of centavos above 0",
              "Inclusions must be a list"
            )
            body[:tour] = "private"
            post "/api/v1/partner/listings", params: body, as: :json, headers: { "Authorization" => Authorization() }
            expect(response.parsed_body["errors"]).to include("Tour details must be an object")
            expect(Listing.count).to eq(0)
          end
        end

        response "422", "a tour too long, with fewer maximum than minimum guests" do
          schema "$ref" => "#/components/schemas/validation_errors"

          before { tour.merge!(min_guests: 5, max_guests: 4, duration_value: 31) }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to include(
              "Maximum guests can't be fewer than the minimum guests",
              "Duration can be at most 30 days"
            )
            expect(Listing.count).to eq(0)
          end
        end

        response "422", "inclusions a tour of its type can't have" do
          schema "$ref" => "#/components/schemas/validation_errors"

          before do
            tour[:inclusions] = [
              { kind: "transport", options: [], price_per_head_cents: 1 },
              { kind: "transport", options: %w[jeepney] },
              { kind: "meal", options: %w[lunch], price_per_head_cents: "350", note: "x" * 121 },
              { kind: "spa" },
              "lunch"
            ]
          end

          run_test! do |refused|
            expect(refused.parsed_body["errors"]).to include(
              "Transport must name at least one of van, tricycle, boat, motorbike, car or other",
              "Transport options must be from van, tricycle, boat, motorbike, car or other",
              "Each kind of inclusion can be listed once",
              "A private tour's inclusions need a price per head: a whole number of centavos, 0 or more",
              "Inclusions are accommodation, transport or meal",
              "An inclusion's note can be at most 120 characters",
              "Each inclusion must be an object"
            )
            tour.merge!(tour_type: "joiner", inclusions: [ { kind: "meal", options: %w[lunch], price_per_head_cents: 35_000 } ])
            post "/api/v1/partner/listings", params: body, as: :json, headers: { "Authorization" => Authorization() }
            expect(response.parsed_body["errors"]).to include(
              "A joiner tour's inclusions are in its price: leave out their price per head"
            )
            expect(Listing.count).to eq(0)
          end
        end
      end

      response "422", "tour details on a listing that isn't a tour" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:tour] = { tour_type: "joiner" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Only tours have tour details")
          expect(Listing.count).to eq(0)
        end
      end

      response "422", "a stay rate on a listing that isn't accommodation" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:stay_rate] = { nightly_price_cents: 100_000 } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Only accommodation has a stay rate")
          expect(Listing.count).to eq(0)
        end
      end

      response "201", "fees on any category" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before { body[:fees] = [ { name: "Environmental fee", amount_cents: 5_000, charged_per: "guest" } ] }

        run_test! do |response|
          expect(response.parsed_body["stay_rate"]).to be_nil
          expect(response.parsed_body["fees"].sole).to include("name" => "Environmental fee", "charged_per" => "guest")
        end
      end

      response "422", "fees that aren't a list of named amounts charged per something we know" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before do
          body[:fees] = [
            { name: "Cleaning fee", amount_cents: 80_000, charged_per: "booking" },
            { name: "cleaning fee", amount_cents: 1, charged_per: "booking" },
            { name: "Kayak", amount_cents: -1, charged_per: "week", required: "no" },
            { amount_cents: 1.5, charged_per: "night" }
          ]
        end

        run_test! do |refused|
          expect(refused.parsed_body["errors"]).to include(
            "Each fee needs a different name",
            "Fee amount must be a whole number of centavos, 0 or more",
            "Fees are charged per booking, night, guest, guest_night, unit, day, hour, pet or pet_night",
            "Whether a fee is required must be true or false",
            "Each fee needs a name"
          )
          body[:fees] = Array.new(21) { |n| { name: "Fee #{n}", amount_cents: 1, charged_per: "booking" } }
          post "/api/v1/partner/listings", params: body, as: :json, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["errors"]).to include("A listing can have at most 20 fees")
          body[:fees] = { name: "Cleaning fee" }
          post "/api/v1/partner/listings", params: body, as: :json, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["errors"]).to include("Fees must be a list")
          expect(Listing.count).to eq(0)
        end
      end

      response "403", "a partner who hasn't passed the ID check" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

        run_test! do |response|
          expect(response.parsed_body["error"]).to eq("Verify your ID before adding a listing")
          expect(Listing.count).to eq(0)
        end
      end

      response "403", "a partner without a business" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner, :id_verified) }

        before { create(:partner_profile, user:, display_name: "Basilia") }

        run_test! do |response|
          expect(response.parsed_body["error"]).to eq("Add a business before adding a listing")
          expect(Listing.count).to eq(0)
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test! { expect(Listing.count).to eq(0) }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/partner/listings/{id}" do
    parameter name: :id, in: :path, schema: { type: :integer }
    parameter name: :Authorization, in: :header, schema: { type: :string }

    let(:user) { create(:user, :partner, :id_verified) }
    let(:Authorization) { bearer_for(user) }
    let(:listing) { create(:listing, partner: user, title: "GoPro Hero 12", status: "paused") }
    let(:id) { listing.id }

    get "One of the signed-in partner's listings" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Any status. Another partner's listing is a 404."
      security [ { bearer: [] } ]

      response "200", "the partner's listing" do
        schema "$ref" => "#/components/schemas/partner_listing"

        run_test! do |response|
          expect(response.parsed_body).to include("id" => listing.id, "title" => "GoPro Hero 12", "status" => "paused")
        end
      end

      response "404", "another partner's listing" do
        schema "$ref" => "#/components/schemas/error"
        let(:listing) { create(:listing) }

        run_test!
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }
        let(:listing) { create(:listing) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end

    patch "Change a listing" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only. The whole listing is sent again, with the same rules as adding one; the area is " \
        "recomputed from the pin. Any `status` sent is ignored: the listing keeps its status. Another partner's " \
        "listing is a 404."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/listing_body" }

      let!(:moalboal) { create(:area, slug: "moalboal", name: "Moalboal", center: "POINT(123.396 9.945)") }
      let!(:oslob) { create(:area, slug: "oslob", name: "Oslob", center: "POINT(123.43 9.46)") }
      let(:listing) do
        create(:listing, partner: user, area: moalboal, title: "GoPro Hero 12", status: "paused",
          location: "POINT(123.37 9.95)")
      end
      let(:category) do
        create(:category, name: "Tour", booking_type: "activity", attribute_schema: {
          type: "object", properties: { duration_hours: { type: "number" } }
        })
      end
      let(:address) do
        { street: "Poblacion", city: "Oslob", province: "Cebu", region: "Central Visayas",
          postal_code: "6025", country: "PH" }
      end
      let(:body) do
        { title: "Whale shark swim", description: "Early morning.", category_id: category.id, address: address,
          location: { lat: 9.46, lng: 123.43 }, attrs: { duration_hours: 3 }, status: "active" }
      end

      response "200", "saved, in the area nearest the new pin, status unchanged" do
        schema "$ref" => "#/components/schemas/partner_listing"

        run_test! do |response|
          expect(response.parsed_body).to include(
            "title" => "Whale shark swim", "description" => "Early morning.", "status" => "paused",
            "location" => { "lat" => 9.46, "lng" => 123.43 }, "attrs" => { "duration_hours" => 3 }
          )
          expect(response.parsed_body["area"]).to eq("slug" => "oslob", "name" => "Oslob")
          expect(response.parsed_body["address"]).to eq(address.stringify_keys)
          expect(listing.reload).to have_attributes(title: "Whale shark swim", category: category, area: oslob,
            status: "paused")
        end
      end

      response "422", "a live listing losing what going live needed" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:category) { listing.category }
        let(:listing) do
          create(:listing, partner: user, area: moalboal, status: "active", location: "POINT(123.37 9.95)",
            description: "Waterproof to 10 m, with a spare battery, a floating grip and a chest mount.")
        end

        before do
          create_photo(listing)
          body.merge!(description: "", attrs: {})
        end

        run_test! do |refused|
          expect(refused.parsed_body["errors"])
            .to eq([ "A live listing needs a description of at least 50 characters: pause it first" ])
          expect(listing.reload).to have_attributes(title: "GoPro Hero 12")
          expect(listing.description).to start_with("Waterproof to 10 m,")
          listing.update!(status: "paused")
          patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
          expect(response).to have_http_status(:ok)
        end
      end

      response "200", "a live listing that already lacked something can still be changed" do
        schema "$ref" => "#/components/schemas/partner_listing"

        let(:category) { listing.category }
        let(:listing) do
          create(:listing, partner: user, area: moalboal, status: "active", location: "POINT(123.37 9.95)")
        end

        before { body.merge!(description: "", attrs: {}) }

        run_test! { |response| expect(response.parsed_body).to include("status" => "active", "title" => "Whale shark swim") }
      end

      response "200", "the cancellation policy changed when sent, kept when left out" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before { body[:cancellation_policy] = "fourteen_days" }

        run_test! do |saved|
          expect(saved.parsed_body["cancellation_policy"]).to eq("fourteen_days")
          body.delete(:cancellation_policy)
          patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["cancellation_policy"]).to eq("fourteen_days")
        end
      end

      response "200", "the booking mode changed when sent, kept when left out" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before do
          listing.update!(booking_mode: "instant")
          body[:booking_mode] = "request"
        end

        run_test! do |saved|
          expect(saved.parsed_body["booking_mode"]).to eq("request")
          body.delete(:booking_mode)
          patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["booking_mode"]).to eq("request")
        end
      end

      response "200", "units added or removed to the number sent, kept when left out" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before { body[:units_count] = 4 }

        run_test! do |saved|
          expect(saved.parsed_body["units_count"]).to eq(4)
          body.delete(:units_count)
          patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["units_count"]).to eq(4)
          patch "/api/v1/partner/listings/#{id}", params: body.merge(units_count: 2), as: :json,
            headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["units_count"]).to eq(2)
          expect(listing.units.pluck(:position)).to eq([ 1, 2 ])
        end
      end

      response "422", "fewer units than are booked on one day (RAA-118)" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before do
          body[:units_count] = 1
          listing.units.create!(position: 2)
          create(:booking, listing:, starts_on: Date.current + 1, ends_on: Date.current + 2, quantity: 2)
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "2 units are booked on the same day: keep at least 2" ])
          expect(listing.units.count).to eq(2)
        end
      end

      response "200", "photos put in the order sent, those left out deleted, kept when left out" do
        schema "$ref" => "#/components/schemas/partner_listing"

        let!(:beach) { create_photo(listing) }
        let!(:boat) { create_photo(listing) }
        let!(:reef) { create_photo(listing, uploaded: false) }

        before { body[:photos] = [ reef.id, boat.id ] }

        run_test! do |saved|
          expect(saved.parsed_body["photos"].map { |photo| photo.slice("id", "uploaded") })
            .to eq([ { "id" => reef.id, "uploaded" => false }, { "id" => boat.id, "uploaded" => true } ])
          expect(listing.photos.reload.map { |photo| [ photo.position, photo ] }).to eq([ [ 1, reef ], [ 2, boat ] ])
          expect(ListingPhoto.exists?(beach.id)).to be(false)

          body.delete(:photos)
          patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["photos"].pluck("id")).to eq([ reef.id, boat.id ])
          patch "/api/v1/partner/listings/#{id}", params: body.merge(photos: [ boat.id, reef.id ]),
            as: :json, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["photos"].pluck("id")).to eq([ boat.id, reef.id ])
        end
      end

      response "422", "another listing's photo" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:other) { create_photo(create(:listing)) }

        before { body[:photos] = [ other.id ] }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Photos must be this listing's photos" ])
          expect(other.reload.listing).not_to eq(listing)
        end
      end

      response "200", "moved to another of the partner's businesses when sent, kept when left out" do
        schema "$ref" => "#/components/schemas/partner_listing"

        let(:motors) { create(:business, partner: user, name: "Basilia Motor Rentals") }

        before do
          listing
          body[:business_id] = motors.id
        end

        run_test! do |saved|
          expect(saved.parsed_body["business"]).to eq("id" => motors.id, "name" => "Basilia Motor Rentals")
          body.delete(:business_id)
          patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["business"]["id"]).to eq(motors.id)
        end
      end

      response "422", "another partner's business" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:business_id] = create(:business).id }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Business must be one of your businesses")
          expect(listing.reload.title).to eq("GoPro Hero 12")
        end
      end

      response "422", "zero units" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body[:units_count] = 0 }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Units must be a whole number from 1 to 100")
          expect(listing.units.count).to eq(1)
        end
      end

      response "200", "landmarks replaced when sent, kept when left out" do
        schema "$ref" => "#/components/schemas/partner_listing"

        let(:kawasan) { create(:landmark, name: "Kawasan Falls", area: moalboal) }
        let(:sumilon) { create(:landmark, name: "Sumilon Island", area: oslob) }

        before do
          listing.update!(category:)
          listing.listing_landmarks.create!(landmark: kawasan)
          body[:landmark_ids] = [ sumilon.id ]
        end

        run_test! do |saved|
          expect(saved.parsed_body["landmarks"].pluck("name")).to eq([ "Sumilon Island" ])
          body.delete(:landmark_ids)
          patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["landmarks"].pluck("name")).to eq([ "Sumilon Island" ])
          patch "/api/v1/partner/listings/#{id}", params: body.merge(landmark_ids: []), as: :json,
            headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["landmarks"]).to eq([])
        end
      end

      response "200", "a landmark unpublished since it was picked can stay; a transfer's served landmarks stay" do
        schema "$ref" => "#/components/schemas/partner_listing"

        let(:unpublished) { create(:landmark, :draft, name: "Kawasan Falls", area: moalboal) }
        let(:served) { create(:landmark, name: "Mactan airport", area: oslob) }

        before do
          listing.update!(category:)
          listing.listing_landmarks.create!(landmark: unpublished)
          listing.listing_landmarks.create!(landmark: served, relation: "serves")
          body[:landmark_ids] = [ unpublished.id ]
        end

        run_test! do |response|
          expect(response.parsed_body["landmarks"].pluck("name")).to eq([ "Kawasan Falls" ])
          expect(listing.listing_landmarks.pluck(:landmark_id, :relation))
            .to contain_exactly([ unpublished.id, "visits" ], [ served.id, "serves" ])
        end
      end

      response "200", "landmarks dropped when the listing stops being an activity" do
        schema "$ref" => "#/components/schemas/partner_listing"

        before do
          listing.update!(category:)
          listing.listing_landmarks.create!(landmark: create(:landmark, area: moalboal))
          body.merge!(category_id: create(:category, name: "Camera").id, attrs: {})
        end

        run_test! do |response|
          expect(response.parsed_body["landmarks"]).to eq([])
          expect(listing.listing_landmarks.count).to eq(0)
        end
      end

      context "accommodation (RAA-104)" do
        let(:category) { create(:category, :accommodation) }
        let(:listing) { create(:listing, :stay, partner: user, category:, area: moalboal, status: "draft") }

        before { body.merge!(attrs: { place_type: "entire_place", guests: 4 }) }

        response "200", "the stay rate and fees replaced when sent, kept when left out" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before do
            create(:listing_fee, listing:, name: "Old fee", position: 1)
            body.merge!(stay_rate: { nightly_price_cents: 180_000, base_guests: 3 },
              fees: [ { name: "Cleaning fee", amount_cents: 80_000, charged_per: "booking" } ])
          end

          run_test! do |saved|
            expect(saved.parsed_body["stay_rate"]).to include("nightly_price_cents" => 180_000, "base_guests" => 3)
            expect(saved.parsed_body["fees"].pluck("name")).to eq([ "Cleaning fee" ])
            body.except!(:stay_rate, :fees)
            patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
            expect(response.parsed_body["stay_rate"]).to include("nightly_price_cents" => 180_000)
            expect(response.parsed_body["fees"].pluck("name")).to eq([ "Cleaning fee" ])
            body[:fees] = []
            patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
            expect(response.parsed_body["fees"]).to eq([])
            expect(StayRate.count).to eq(1)
          end
        end

        response "200", "a back-filled listing with no price yet can still be changed without one" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before { listing.stay_rate.update_columns(nightly_price_cents: 0, base_guests: 1) }

          run_test! do |response|
            expect(response.parsed_body["stay_rate"]).to include("nightly_price_cents" => 0)
          end
        end

        response "422", "the place made to sleep fewer than the guests its price includes" do
          schema "$ref" => "#/components/schemas/validation_errors"

          before { body[:attrs][:guests] = 1 }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to include(
              "Guests included in the price can't be more than the 1 guest the place sleeps"
            )
            expect(listing.reload.attrs["guests"]).to eq(4)
          end
        end

        response "200", "the stay rate dropped when the listing stops being accommodation" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before { body.merge!(category_id: create(:category, booking_type: "activity").id, attrs: {}) }

          run_test! do |response|
            expect(response.parsed_body["stay_rate"]).to be_nil
            expect(StayRate.count).to eq(0)
          end
        end
      end

      context "a vehicle (RAA-149)" do
        let(:category) { create(:category, :motorcycle) }
        let(:listing) { create(:listing, :vehicle, partner: user, area: moalboal, status: "draft") }

        before do
          body.merge!(attrs: { make: "Honda", model: "Click 125", engine_cc: 125, transmission: "automatic", seats: 2,
            amenities: %w[rider_helmet] })
        end

        response "200", "the vehicle rate replaced when sent, kept when left out" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before { body[:vehicle_rate] = { daily_price_cents: 60_000, delivery_fee_cents: 10_000 } }

          run_test! do |saved|
            expect(saved.parsed_body["vehicle_rate"]).to include("daily_price_cents" => 60_000, "delivery_fee_cents" => 10_000)
            body.delete(:vehicle_rate)
            patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
            expect(response.parsed_body["vehicle_rate"]).to include("daily_price_cents" => 60_000)
            expect(VehicleRate.count).to eq(1)
          end
        end

        response "200", "a back-filled vehicle with no price yet can still be changed without one" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before { listing.vehicle_rate.update_columns(daily_price_cents: 0) }

          run_test! do |response|
            expect(response.parsed_body["vehicle_rate"]).to include("daily_price_cents" => 0)
            expect(response.parsed_body["live_blockers"]).to include("price")
          end
        end

        response "200", "the vehicle rate dropped when the listing stops being a vehicle" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before { body.merge!(category_id: create(:category, booking_type: "activity").id, attrs: {}) }

          run_test! do |response|
            expect(response.parsed_body["vehicle_rate"]).to be_nil
            expect(VehicleRate.count).to eq(0)
          end
        end
      end

      context "gear, priced flat (RAA-191)" do
        let(:category) { create(:category, :gear) }
        let(:listing) { create(:listing, :gear, partner: user, area: moalboal, status: "draft") }

        before { body[:attrs] = {} }

        response "200", "its price per item and day set when sent, kept when left out" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before { body[:flat_rate] = { price_cents: 30_000 } }

          run_test! do |saved|
            expect(saved.parsed_body["flat_rate"]).to eq("price_cents" => 30_000)
            expect(saved.parsed_body["live_blockers"]).not_to include("price")
            body.delete(:flat_rate)
            patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
            expect(response.parsed_body["flat_rate"]).to eq("price_cents" => 30_000)
          end
        end

        response "422", "a price of 0, or a flat price on a vehicle" do
          schema "$ref" => "#/components/schemas/validation_errors"

          context "with 0" do
            before { body[:flat_rate] = { price_cents: 0 } }

            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Price must be a whole number of centavos above 0" ]) }
          end

          context "on a vehicle" do
            let(:category) { create(:category, :motorcycle) }
            let(:listing) { create(:listing, :vehicle, partner: user, area: moalboal, status: "draft") }

            before do
              body.merge!(attrs: { make: "Honda", model: "Click 125", engine_cc: 125, transmission: "automatic", seats: 2 },
                flat_rate: { price_cents: 30_000 })
            end

            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Only gear or a transfer has a flat price" ]) }
          end
        end

        response "404", "another partner's gear" do
          let(:listing) { create(:listing, :gear, area: moalboal) }

          before { body[:flat_rate] = { price_cents: 30_000 } }

          run_test! { expect(listing.reload.flat_rate).to be_nil }
        end
      end

      context "a tour (RAA-110)" do
        let(:category) { create(:category, :tour) }
        let(:listing) { create(:listing, :tour, partner: user, area: moalboal) }

        before { body[:attrs] = { guide_included: true } }

        response "200", "tour details replaced when sent, kept when left out" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before do
            listing.tour_inclusions.create!(kind: "meal", options: %w[lunch])
            body[:tour] = { tour_type: "private", min_guests: 1, max_guests: 6, max_groups_per_day: 2, duration_value: 3,
              duration_unit: "hours", base_price_cents: 400_000,
              inclusions: [ { kind: "transport", options: %w[tricycle], price_per_head_cents: 10_000 } ] }
          end

          run_test! do |saved|
            expect(saved.parsed_body["tour"]).to include(
              "tour_type" => "private", "base_price_cents" => 400_000,
              "inclusions" => [ { "kind" => "transport", "options" => %w[tricycle], "note" => nil, "price_per_head_cents" => 10_000 } ]
            )
            body.delete(:tour)
            patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
            expect(response.parsed_body["tour"]).to include("tour_type" => "private", "base_price_cents" => 400_000)
            expect(TourDetail.count).to eq(1)
          end
        end

        response "422", "a listing made a tour while it has more photos than a tour takes" do
          schema "$ref" => "#/components/schemas/validation_errors"

          let(:listing) { create(:listing, partner: user, area: moalboal, status: "draft") }

          before do
            6.times { create_photo(listing) }
            body[:tour] = { tour_type: "joiner", min_guests: 1, max_guests: 10, max_groups_per_day: 1, duration_value: 4,
              duration_unit: "hours", base_price_cents: 100_000 }
          end

          run_test! do |refused|
            expect(refused.parsed_body["errors"]).to include("A tour can have at most 5 photos: remove 1 first")
            expect(listing.reload.category).not_to be_tour
            body[:photos] = listing.photos.pluck(:id).first(5)
            patch "/api/v1/partner/listings/#{id}", params: body, as: :json, headers: { "Authorization" => Authorization() }
            expect(response).to have_http_status(:ok)
            expect(listing.photos.count).to eq(5)
          end
        end

        response "200", "a back-filled tour with no price yet can still be changed without tour details" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before { listing.tour_detail.update_columns(base_price_cents: 0) }

          run_test! do |response|
            expect(response.parsed_body["tour"]).to include("base_price_cents" => 0)
          end
        end

        response "200", "tour details dropped when the listing stops being a tour" do
          schema "$ref" => "#/components/schemas/partner_listing"

          before do
            listing.tour_inclusions.create!(kind: "meal", options: %w[lunch])
            body.merge!(category_id: create(:category, booking_type: "activity").id, attrs: {})
          end

          run_test! do |response|
            expect(response.parsed_body["tour"]).to be_nil
            expect(response.parsed_body["photo_limit"]).to eq(12)
            expect([ TourDetail.count, TourInclusion.count ]).to eq([ 0, 0 ])
          end
        end
      end

      response "422", "a listing made a tour without tour details" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body.merge!(category_id: create(:category, :tour).id, attrs: { guide_included: true }) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Tour details are required for a tour")
        end
      end

      response "422", "a listing made accommodation without a stay rate" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { body.merge!(category_id: create(:category, :accommodation).id, attrs: {}) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Stay rate is required for accommodation")
        end
      end

      response "422", "missing and wrong-typed values" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { title: "", category_id: "1", location: { lat: 9.46 }, attrs: "none", address: "Oslob" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(
            "Title is required", "Category is required", "Longitude must be a number between -180 and 180",
            "Details must be an object", "Address must be an object"
          )
          expect(listing.reload.title).to eq("GoPro Hero 12")
        end
      end

      response "404", "another partner's listing" do
        schema "$ref" => "#/components/schemas/error"
        let(:listing) { create(:listing, title: "Someone else's camera") }

        run_test! { expect(listing.reload.title).to eq("Someone else's camera") }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }
        let(:listing) { create(:listing) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end

    delete "Delete a listing" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Deletes the listing for good, and takes it out of any guest's trip. A listing with " \
        "bookings, even cancelled ones, can't be deleted: delist it instead (RAA-118). Another partner's listing is " \
        "a 404."
      security [ { bearer: [] } ]

      response "204", "deleted" do
        run_test! { expect(Listing.exists?(listing.id)).to be(false) }
      end

      response "204", "deleted while in a guest's trip: the item goes, the trip stays" do
        let!(:item) { create(:trip_item, listing: listing.tap { |active| active.update!(status: "active") }) }

        run_test! do
          expect(TripItem.exists?(item.id)).to be(false)
          expect(Trip.exists?(item.trip_id)).to be(true)
        end
      end

      response "422", "a listing with bookings (RAA-118)" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { create(:booking, listing:, status: "cancelled") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "A listing with bookings can't be deleted: delist it instead" ])
          expect(Listing.exists?(listing.id)).to be(true)
        end
      end

      response "404", "another partner's listing" do
        schema "$ref" => "#/components/schemas/error"
        let(:listing) { create(:listing) }

        run_test! { expect(Listing.exists?(listing.id)).to be(true) }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }
        let(:listing) { create(:listing) }

        run_test! { expect(Listing.exists?(listing.id)).to be(true) }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
