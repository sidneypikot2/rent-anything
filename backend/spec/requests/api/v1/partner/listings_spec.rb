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
          create(:listing, partner: user, business: gear, category: camera, title: "GoPro Hero 12", status: "pending")
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
            "units_count" => 1
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

        before { body.merge!(title: "x" * 121, description: "x" * 5001) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(
            "Title is too long (maximum is 120 characters)", "Description is too long (maximum is 5000 characters)"
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
            "Fees are charged per booking, night, guest, guest_night or unit",
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
    let(:listing) { create(:listing, partner: user, title: "GoPro Hero 12", status: "pending") }
    let(:id) { listing.id }

    get "One of the signed-in partner's listings" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Any status. Another partner's listing is a 404."
      security [ { bearer: [] } ]

      response "200", "the partner's listing" do
        schema "$ref" => "#/components/schemas/partner_listing"

        run_test! do |response|
          expect(response.parsed_body).to include("id" => listing.id, "title" => "GoPro Hero 12", "status" => "pending")
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
        create(:listing, partner: user, area: moalboal, title: "GoPro Hero 12", status: "pending",
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
            "title" => "Whale shark swim", "description" => "Early morning.", "status" => "pending",
            "location" => { "lat" => 9.46, "lng" => 123.43 }, "attrs" => { "duration_hours" => 3 }
          )
          expect(response.parsed_body["area"]).to eq("slug" => "oslob", "name" => "Oslob")
          expect(response.parsed_body["address"]).to eq(address.stringify_keys)
          expect(listing.reload).to have_attributes(title: "Whale shark swim", category: category, area: oslob,
            status: "pending")
        end
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
        let(:listing) { create(:listing, :stay, partner: user, category:, area: moalboal) }

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
      description "Partner-only. Deletes the listing for good, and takes it out of any guest's trip. Another " \
        "partner's listing is a 404."
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
