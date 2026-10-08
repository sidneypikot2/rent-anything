require "swagger_helper"

RSpec.describe "Partner listings", type: :request do
  path "/api/v1/partner/listings" do
    get "The signed-in partner's listings" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Every listing the partner owns, in any status, ordered by category name, then " \
        "title. The exact location is included: the reader owns the listing."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }

      response "200", "only the partner's own listings, by category then title" do
        schema type: :array, items: { "$ref" => "#/components/schemas/partner_listing" }

        let(:camera) { create(:category, name: "Action camera") }
        let(:tour) { create(:category, name: "Tour", booking_type: "activity") }

        before do
          create(:listing, partner: user, category: tour, title: "Island hopping", status: "draft",
            location: "POINT(123.80 11.17)")
          create(:listing, partner: user, category: camera, title: "Insta360 X4")
          create(:listing, partner: user, category: camera, title: "GoPro Hero 12", status: "pending")
          create(:listing, category: camera, title: "Someone else's camera")
        end

        run_test! do |response|
          expect(response.parsed_body.pluck("title")).to eq([ "GoPro Hero 12", "Insta360 X4", "Island hopping" ])
          tour_row = response.parsed_body.last
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
        "(`/api/v1/partner/verification`); until then it is a 403."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/listing_body" }

      let(:user) { create(:user, :partner, :id_verified) }
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
            "attrs" => { "guide_included" => true, "duration_hours" => 4 }
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
            address: { street: "", city: 6032, province: 1, region: "Central Visayas" } }
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(
            "Title is required", "Description must be text", "Category is required",
            "Street is required", "City is required", "Province must be text", "ZIP code is required",
            "Country is required",
            "Latitude must be a number between -90 and 90", "Longitude must be a number between -180 and 180",
            "Details must be an object"
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

      response "403", "a partner who hasn't passed the ID check" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

        run_test! do |response|
          expect(response.parsed_body["error"]).to eq("Verify your ID before adding a listing")
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
      description "Partner-only. Deletes the listing for good. Another partner's listing is a 404."
      security [ { bearer: [] } ]

      response "204", "deleted" do
        run_test! { expect(Listing.exists?(listing.id)).to be(false) }
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
