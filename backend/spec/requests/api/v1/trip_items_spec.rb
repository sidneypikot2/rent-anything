require "swagger_helper"

RSpec.describe "Trip items", type: :request do
  let(:user) { create(:user) }
  let(:Authorization) { bearer_for(user) }
  let(:day) { 20.days.from_now.to_date }
  let(:bantayan) { create(:area, kind: "island", name: "Bantayan Island") }
  let(:santa_fe) { create(:area, kind: "town", name: "Santa Fe", parent: bantayan) }
  let(:tour) { create(:listing, area: santa_fe, title: "Island hopping") }

  path "/api/v1/trip_items" do
    post "Add a listing to a trip" do
      tags "Trips"
      consumes "application/json"
      produces "application/json"
      description "Guest-only. Adds the listing to `trip_id`, or, without one, to a new trip named after the " \
        "destination and dates (\"Bantayan Island · Nov 12–15\"), or `trip_name` if the guest typed one, with " \
        "`quantity` guests (`guests` when sent). Gear is booked by the count: its `quantity` is how many, and " \
        "adding gear the trip already holds unbooked on the same dates raises that item's quantity instead of " \
        "adding a second. The trip's dates grow " \
        "to cover the item's. Dates are optional, both or neither, `YYYY-MM-DD` and not in the past: an " \
        "undated item can't be checked out until it has one. `quantity` is 1 to 99, default 1. Answers with " \
        "the trip. A rental vehicle with seats (RAA-191) takes enough of its units for `quantity` people, rounded " \
        "up, or `units` when the guest chose more (up to one each), and never more people than its whole fleet " \
        "seats. Several items at once (RAA-187, a mix of room types from `GET /stay_mixes`): `items` instead " \
        "of one item's fields, all added or none; a new trip is named and dated after the first."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          listing_id: { type: :integer },
          starts_on: { type: :string, format: :date, nullable: true },
          ends_on: { type: :string, format: :date, nullable: true },
          quantity: { type: :integer, description: "Its guests; for gear, how many" },
          guests: { type: :integer, description: "A new trip's guests, 1 to 50; defaults to quantity" },
          room_guests: ROOM_GUESTS_BODY,
          pets: PETS_BODY,
          units: UNITS_BODY,
          pickup_time: PICKUP_TIME_BODY,
          **DELIVERY_FIELDS,
          items: {
            type: :array, minItems: 1, maxItems: 10, description: "Instead of listing_id and the fields above",
            items: {
              type: :object,
              properties: {
                listing_id: { type: :integer },
                starts_on: { type: :string, format: :date, nullable: true },
                ends_on: { type: :string, format: :date, nullable: true },
                quantity: { type: :integer },
                room_guests: ROOM_GUESTS_BODY,
                pets: PETS_BODY,
                units: UNITS_BODY,
                pickup_time: PICKUP_TIME_BODY,
                **DELIVERY_FIELDS
              },
              required: %w[listing_id]
            }
          },
          trip_id: { type: :integer, nullable: true, description: "Omit or null for a new trip" },
          trip_name: {
            type: :string, nullable: true,
            description: "A new trip's name, up to 80 characters; blank or omitted names it after the destination " \
              "and dates. Ignored with trip_id"
          }
        }
      }

      response "201", "the first add starts a trip" do
        schema "$ref" => "#/components/schemas/trip"
        let(:body) { { listing_id: tour.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, quantity: 2 } }

        run_test! do |response|
          expect(response.parsed_body).to include(
            "name" => "Bantayan Island · #{Trips::Destination.dates(day, day + 1)}",
            "guests" => 2, "starts_on" => day.iso8601, "ends_on" => (day + 1).iso8601
          )
          expect(TripItem.last.followed_suggestion).to be(true)
        end
      end

      response "201", "a new trip the guest named" do
        schema "$ref" => "#/components/schemas/trip"
        let(:body) { { listing_id: tour.id, starts_on: day.iso8601, ends_on: day.iso8601, trip_name: "  Barkada weekend " } }

        run_test! { |response| expect(response.parsed_body["name"]).to eq("Barkada weekend") }
      end

      response "201", "a blank trip name falls back to the destination and dates" do
        schema "$ref" => "#/components/schemas/trip"
        let(:body) { { listing_id: tour.id, starts_on: day.iso8601, ends_on: day.iso8601, trip_name: "  " } }

        run_test! do |response|
          expect(response.parsed_body["name"]).to eq("Bantayan Island · #{Trips::Destination.dates(day, day)}")
        end
      end

      response "201", "an add to an existing trip extends its dates" do
        schema "$ref" => "#/components/schemas/trip"
        let(:trip) { create(:trip, user:, starts_on: day, ends_on: day + 3) }
        let(:body) do
          { listing_id: tour.id, starts_on: (day + 5).iso8601, ends_on: (day + 5).iso8601, trip_id: trip.id, trip_name: "Ignored" }
        end

        run_test! do |response|
          expect(response.parsed_body).to include("id" => trip.id, "ends_on" => (day + 5).iso8601, "name" => trip.name)
          expect(response.parsed_body["items"].size).to eq(1)
        end
      end

      response "201", "an add from another place names it in the trip's name" do
        schema "$ref" => "#/components/schemas/trip"
        let(:range) { Trips::Destination.dates(day, day + 3) }
        let(:trip) { create(:trip, user:, name: "Bantayan Island · #{range}", starts_on: day, ends_on: day + 3) }
        let(:city_tour) { create(:listing, area: create(:area, kind: "city", name: "Cebu City"), title: "Cebu City tour") }
        let(:body) { { listing_id: city_tour.id, starts_on: (day + 2).iso8601, ends_on: (day + 2).iso8601, trip_id: trip.id } }

        before { create(:trip_item, trip:, listing: tour, starts_on: day, ends_on: day) }

        run_test! do |response|
          expect(response.parsed_body["name"]).to eq("Bantayan Island · Cebu City · #{range}")
        end
      end

      context "with gear, booked by the count" do
        let(:camera) { create(:listing, :gear, area: santa_fe) }
        let(:trip) { create(:trip, user:, starts_on: day, ends_on: day + 2) }
        let!(:held) { create(:trip_item, trip:, listing: camera, starts_on: day, ends_on: day + 1, quantity: 1) }

        response "201", "the same gear on the same dates raises the count already there" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) { { listing_id: camera.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, quantity: 2, trip_id: trip.id } }

          run_test! do |response|
            expect(response.parsed_body["items"].map { _1.slice("id", "quantity", "max_quantity") })
              .to eq([ { "id" => held.id, "quantity" => 3, "max_quantity" => 3 } ])
          end
        end

        response "201", "the same gear on other dates is an item of its own" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) { { listing_id: camera.id, starts_on: (day + 2).iso8601, ends_on: (day + 2).iso8601, trip_id: trip.id } }

          run_test! { |response| expect(response.parsed_body["items"].map { _1["quantity"] }).to eq([ 1, 1 ]) }
        end

        response "201", "gear already booked isn't added to" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) { { listing_id: camera.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, trip_id: trip.id } }

          before { create(:booking, listing: camera, trip_item: held, user:, starts_on: day, ends_on: day + 1) }

          run_test! { |response| expect(response.parsed_body["items"].size).to eq(2) }
        end

        response "422", "more of the gear than the partner lists" do
          let(:body) { { listing_id: camera.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, quantity: 3, trip_id: trip.id } }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to eq([ "Only 3 of DJI Osmo Action 4 are listed, and this trip already has 1 for these dates" ])
            expect(held.reload.quantity).to eq(1)
          end
        end

        response "201", "a new trip's guests sent apart from the count" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) { { listing_id: camera.id, starts_on: day.iso8601, ends_on: day.iso8601, quantity: 2, guests: 4 } }

          run_test! do |response|
            expect(response.parsed_body).to include("guests" => 4)
            expect(response.parsed_body["items"].sole["quantity"]).to eq(2)
          end
        end
      end

      context "with a rental vehicle, booked by the seat (RAA-191)" do
        # 8 Honda Clicks of 2 seats each.
        let(:click) { create(:listing, :vehicle, area: santa_fe) }

        before { click.units.create!((2..8).map { |position| { position: } }) }

        response "201", "10 people take 5 motorbikes" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) { { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, quantity: 10 } }

          run_test! do |response|
            expect(response.parsed_body["items"].sole.slice("quantity", "seats", "units", "units_chosen", "units_free", "max_guests"))
              .to eq("quantity" => 10, "seats" => 2, "units" => 5, "units_chosen" => nil, "units_free" => 8, "max_guests" => 16)
          end
        end

        response "201", "one more than needed, for someone to ride alone" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) { { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, quantity: 10, units: 6 } }

          run_test! { |response| expect(response.parsed_body["items"].sole.slice("units", "units_chosen")).to eq("units" => 6, "units_chosen" => 6) }
        end

        response "201", "picked up at 8:30, due back at 8:30 the next day (RAA-195)" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) { { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, quantity: 1, pickup_time: "08:30" } }

          run_test! do |response|
            item = response.parsed_body["items"].sole
            expect(item["pickup_time"]).to eq("08:30")
            expect(Time.zone.parse(item["returns_at"])).to eq(Booking.rental_period(day, day + 1, "08:30").end)
          end
        end

        # Delivery and pick-up (RAA-195), where the shop offers them, to the address typed.
        response "201", "delivered to the guest's hotel and collected there at the end" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) do
            { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, quantity: 2,
              delivery: true, return_pickup: true, delivery_address: "  Kota Beach Resort, Santa Fe " }
          end

          before { click.vehicle_rate.update!(delivery_fee_cents: 15_000, return_pickup_fee_cents: 10_000) }

          run_test! do |response|
            expect(response.parsed_body["items"].sole.slice("delivery", "return_pickup", "delivery_address"))
              .to eq("delivery" => true, "return_pickup" => true, "delivery_address" => "Kota Beach Resort, Santa Fe")
          end
        end

        response "422", "delivery the shop doesn't offer, or with no address" do
          schema "$ref" => "#/components/schemas/validation_errors"
          let(:body) { { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, delivery: true, delivery_address: "Kota" } }

          context "with a shop that doesn't deliver" do
            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "This shop doesn't deliver" ]) }
          end

          context "with no address" do
            let(:body) { { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, return_pickup: true } }

            before { click.vehicle_rate.update!(return_pickup_fee_cents: 0) }

            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Add the address for the delivery or pick-up" ]) }
          end

          context "with delivery as text" do
            let(:body) { { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, delivery: "yes" } }

            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Delivery must be true or false" ]) }
          end
        end

        # Child helmets (RAA-205): a motorcycle shop's, at most one for each motorbike.
        response "201", "child helmets for the children on the motorbikes" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) { { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, quantity: 4, child_helmets: 2 } }

          before { click.vehicle_rate.update!(child_helmet_fee_cents: 5_000) }

          run_test! { |response| expect(response.parsed_body["items"].sole["child_helmets"]).to eq(2) }
        end

        response "422", "child helmets the shop doesn't offer, or more than the motorbikes" do
          schema "$ref" => "#/components/schemas/validation_errors"
          let(:body) { { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, quantity: 2, child_helmets: 1 } }

          context "with a shop that has none" do
            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "This shop doesn't offer child helmets" ]) }
          end

          context "with more than the motorbikes" do
            let(:body) { { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, quantity: 2, child_helmets: 2 } }

            before { click.vehicle_rate.update!(child_helmet_fee_cents: 0) }

            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Child helmets can't be more than the vehicles (1)" ]) }
          end
        end

        response "422", "a pickup time off the half hour, outside the shop's hours, or for a stay" do
          let(:body) { { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, pickup_time: "08:15" } }

          context "with one off the half hour" do
            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Pickup time must be a time on the half hour, like 08:30" ]) }
          end

          context "with one before the shop opens" do
            let(:body) { { listing_id: click.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, pickup_time: "06:00" } }

            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Pickup is from 07:00 to 19:00" ]) }
          end
        end

        response "422", "too few motorbikes, more than the people, units on a tour, or more people than the fleet seats" do
          let(:body) { { listing_id: click.id, quantity: 10, units: 4 } }

          context "with too few" do
            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "10 people need at least 5 motorbikes" ]) }
          end

          context "with more than one each" do
            let(:body) { { listing_id: click.id, quantity: 3, units: 4 } }

            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "4 motorbikes is more than one each for 3" ]) }
          end

          context "with units on a tour" do
            let(:body) { { listing_id: tour.id, quantity: 3, units: 1 } }

            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Only a vehicle can be booked by how many" ]) }
          end

          context "with more people than 8 motorbikes seat" do
            let(:body) { { listing_id: click.id, quantity: 17 } }

            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "This motorbike seats 2. 8 of them seat 16 at most." ]) }
          end

          context "with units that aren't 1 to 99" do
            let(:body) { { listing_id: click.id, quantity: 3, units: 0 } }

            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Units must be from 1 to 99" ]) }
          end
        end

        response "201", "units for each model in one go" do
          schema "$ref" => "#/components/schemas/trip"
          let(:nmax) { create(:listing, :vehicle, area: santa_fe, partner: click.partner, title: "Yamaha NMAX 155") }
          let(:body) do
            { items: [ { listing_id: click.id, starts_on: day.iso8601, ends_on: day.iso8601, quantity: 6, units: 3 },
              { listing_id: nmax.id, starts_on: day.iso8601, ends_on: day.iso8601, quantity: 2, units: 1 } ] }
          end

          run_test! do |response|
            expect(response.parsed_body["items"].map { _1.slice("units", "business") })
              .to eq([ { "units" => 3, "business" => { "id" => click.business_id, "name" => click.business.name } },
                { "units" => 1, "business" => { "id" => click.business_id, "name" => click.business.name } } ])
          end
        end
      end

      response "201", "an undated add" do
        schema "$ref" => "#/components/schemas/trip"
        let(:body) { { listing_id: tour.id } }

        run_test! do |response|
          expect(response.parsed_body).to include("name" => "Bantayan Island", "starts_on" => nil)
          expect(response.parsed_body["items"].first).to include("starts_on" => nil, "quantity" => 1)
        end
      end

      context "with several items at once (RAA-187)" do
        include_context "a business with three room types"

        let(:stay) { { starts_on: day.iso8601, ends_on: (day + 2).iso8601 } }
        let(:items) do
          [
            stay.merge(listing_id: family_room.id, room_guests: [ { adults: 4, children: 1, infants: 1 } ], pets: 1),
            stay.merge(listing_id: dorm.id, quantity: 1)
          ]
        end

        response "201", "a mix of room types added in one go" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) { { items:, trip_name: "Barkada weekend" } }

          run_test! do |response|
            expect(response.parsed_body).to include("name" => "Barkada weekend", "guests" => 7)
            expect(response.parsed_body["items"].map { _1.slice("quantity", "pets") }).to contain_exactly(
              { "quantity" => 6, "pets" => 1 }, { "quantity" => 1, "pets" => 0 }
            )
          end
        end

        response "201", "a mix added to an existing trip" do
          schema "$ref" => "#/components/schemas/trip"
          let(:trip) { create(:trip, user:, starts_on: day, ends_on: day + 1) }
          let(:body) { { items:, trip_id: trip.id } }

          run_test! do |response|
            expect(response.parsed_body).to include("id" => trip.id, "ends_on" => (day + 2).iso8601)
            expect(trip.items.count).to eq(2)
          end
        end

        response "422", "one item refused: nothing is added" do
          schema "$ref" => "#/components/schemas/validation_errors"

          context "with pets in the dorm" do
            let(:body) { { items: [ items.first, items.last.merge(pets: 1) ] } }

            run_test! do |response|
              expect(response.parsed_body["errors"]).to eq([ "Item 2: This place doesn't allow pets" ])
              expect(Trip.count).to eq(0)
            end
          end

          context "with no items" do
            let(:body) { { items: [] } }

            run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Items must be a list of 1 to 10 items" ]) }
          end

          context "with items and one item's fields" do
            let(:body) { { items:, listing_id: tour.id } }

            run_test! do |response|
              expect(response.parsed_body["errors"]).to eq([ "Send items or one item's fields, not both" ])
            end
          end
        end

        response "404", "a mix into another guest's trip" do
          schema "$ref" => "#/components/schemas/error"
          let(:body) { { items:, trip_id: create(:trip).id } }

          run_test! { expect(TripItem.count).to eq(0) }
        end
      end

      response "422", "a listing that can't be booked, or a bad quantity" do
        schema "$ref" => "#/components/schemas/validation_errors"

        context "with a draft listing" do
          let(:body) { { listing_id: create(:listing, status: "draft").id } }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "That listing isn't available to book" ]) }
        end

        context "with a listing id sent as text" do
          let(:body) { { listing_id: tour.id.to_s } }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Listing must be a whole number" ]) }
        end

        context "with a quantity that isn't a number" do
          let(:body) { { listing_id: tour.id, quantity: "2" } }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Quantity must be a whole number" ]) }
        end

        context "with a trip name over 80 characters" do
          let(:body) { { listing_id: tour.id, trip_name: "x" * 81 } }

          run_test! { expect(Trip.count).to eq(0) }
        end

        context "with too many" do
          let(:body) { { listing_id: tour.id, quantity: 100 } }

          run_test! { expect(Trip.count).to eq(0) }
        end
      end

      response "404", "into another guest's trip" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { { listing_id: tour.id, trip_id: create(:trip).id } }

        run_test! { expect(TripItem.count).to eq(0) }
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }
        let(:body) { { listing_id: tour.id } }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }
        let(:body) { { listing_id: tour.id } }

        run_test!
      end
    end
  end

  path "/api/v1/trip_items/{id}" do
    parameter name: :id, in: :path, schema: { type: :integer }
    let(:trip) { create(:trip, user:, starts_on: day, ends_on: day + 3) }
    let(:item) { create(:trip_item, trip:, listing: tour, starts_on: day, ends_on: day) }
    let(:id) { item.id }

    patch "Change an item or move it to another trip" do
      tags "Trips"
      consumes "application/json"
      produces "application/json"
      description "Guest-only. Only the keys sent change; a date not sent keeps its value. `move_to_trip_id` moves it to another of the guest's " \
        "trips. The trip it ends up in grows to cover its dates; the one it left keeps its dates. Answers with " \
        "the trip it ends up in."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          starts_on: { type: :string, format: :date, nullable: true },
          ends_on: { type: :string, format: :date, nullable: true },
          quantity: { type: :integer, description: "Without room_guests, drops a stay's split back to an even one" },
          room_guests: ROOM_GUESTS_BODY,
          pets: PETS_BODY,
          units: UNITS_BODY,
          pickup_time: PICKUP_TIME_BODY,
          **DELIVERY_FIELDS,
          move_to_trip_id: { type: :integer }
        }
      }

      context "with a rental vehicle (RAA-191)" do
        let(:click) { create(:listing, :vehicle, area: santa_fe) }
        let(:item) { create(:trip_item, trip:, listing: click, starts_on: day, ends_on: day, quantity: 4, units: 4) }

        before { click.units.create!((2..8).map { |position| { position: } }) }

        response "200", "fewer people drop chosen units that no longer fit, back to derived" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) { { quantity: 3 } }

          run_test! { |response| expect(response.parsed_body["items"].sole.slice("units", "units_chosen")).to eq("units" => 2, "units_chosen" => nil) }
        end

        response "200", "new units for the same people" do
          schema "$ref" => "#/components/schemas/trip"
          let(:body) { { units: 3 } }

          run_test! { |response| expect(response.parsed_body["items"].sole.slice("units", "units_chosen")).to eq("units" => 3, "units_chosen" => 3) }
        end
      end

      response "200", "re-dated past the trip's end: the trip grows" do
        schema "$ref" => "#/components/schemas/trip"
        let(:body) { { starts_on: (day + 4).iso8601, ends_on: (day + 4).iso8601, quantity: 3 } }

        run_test! do |response|
          expect(response.parsed_body["ends_on"]).to eq((day + 4).iso8601)
          expect(response.parsed_body["items"].first).to include("quantity" => 3)
        end
      end

      response "200", "moved to another trip" do
        schema "$ref" => "#/components/schemas/trip"
        let(:other) { create(:trip, :undated, user:) }
        let(:body) { { move_to_trip_id: other.id } }

        before { item.update!(followed_suggestion: true) }

        run_test! do |response|
          expect(response.parsed_body).to include("id" => other.id, "starts_on" => day.iso8601)
          expect(trip.items.count).to eq(0)
          expect(item.reload.followed_suggestion).to be(false)
        end
      end

      response "422", "one date cleared" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { starts_on: nil } }

        run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "An item needs both dates or neither" ]) }
      end

      response "404", "another guest's item, or a move into another guest's trip" do
        schema "$ref" => "#/components/schemas/error"

        context "with another guest's item" do
          let(:item) { create(:trip_item) }
          let(:body) { { quantity: 5 } }

          run_test! { expect(item.reload.quantity).to eq(1) }
        end

        context "moving into another guest's trip" do
          let(:body) { { move_to_trip_id: create(:trip).id } }

          run_test! { expect(item.reload.trip).to eq(trip) }
        end
      end
    end

    delete "Remove an item from its trip" do
      tags "Trips"
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "204", "removed; a place the trip no longer has leaves its name" do
        let(:range) { Trips::Destination.dates(day, day + 3) }
        let(:trip) { create(:trip, user:, name: "Bantayan Island · Cebu City · #{range}", starts_on: day, ends_on: day + 3) }
        let(:city_tour) { create(:listing, area: create(:area, kind: "city", name: "Cebu City")) }

        before { create(:trip_item, trip:, listing: city_tour, starts_on: day + 1, ends_on: day + 1) }

        run_test! { expect(trip.reload.name).to eq("Cebu City · #{range}") }
      end

      response "204", "removed; a name the guest typed stays" do
        let(:trip) { create(:trip, user:, name: "Ana's birthday", starts_on: day, ends_on: day + 3) }
        let(:city_tour) { create(:listing, area: create(:area, kind: "city", name: "Cebu City")) }

        before { create(:trip_item, trip:, listing: city_tour, starts_on: day + 1, ends_on: day + 1) }

        run_test! { expect(trip.reload.name).to eq("Ana's birthday") }
      end

      response "204", "removed; the trip stays" do
        run_test! do
          expect(TripItem.exists?(item.id)).to be(false)
          expect(Trip.exists?(trip.id)).to be(true)
        end
      end

      response "404", "another guest's item" do
        schema "$ref" => "#/components/schemas/error"
        let(:item) { create(:trip_item) }

        run_test! { expect(TripItem.exists?(item.id)).to be(true) }
      end
    end
  end
end
