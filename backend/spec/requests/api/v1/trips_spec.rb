require "swagger_helper"

RSpec.describe "Trips", type: :request do
  let(:user) { create(:user) }
  let(:Authorization) { bearer_for(user) }
  let(:day) { 20.days.from_now.to_date }
  let(:bantayan) { create(:area, kind: "island", name: "Bantayan Island", slug: "bantayan-island") }
  let(:santa_fe) { create(:area, kind: "town", name: "Santa Fe", slug: "santa-fe", parent: bantayan) }
  let(:tour) { create(:listing, area: santa_fe, title: "Island hopping") }

  path "/api/v1/trips" do
    get "The signed-in guest's trips" do
      tags "Trips"
      produces "application/json"
      description "Guest-only. The cart: every trip whose `deletes_on` hasn't come, with its items. A trip " \
        "that has ended, or an undated one with no edits for 60 days, shows a deletion notice for 7 days; " \
        "then a daily job deletes its unbooked items. Dated trips come first, " \
        "soonest first; then undated ones, most recently edited first. `view=booked` lists instead every " \
        "trip with a booked item, whenever it was (the Trips page, RAA-139), latest first."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :view, in: :query, required: false, schema: { type: :string, enum: %w[booked] }

      response "200", "with view=booked: every trip with a booked item, latest first" do
        schema type: :array, items: { "$ref" => "#/components/schemas/trip" }
        let(:view) { "booked" }

        before do
          booked = lambda do |trip, starts_on|
            item = create(:trip_item, trip:, listing: tour)
            trip.update_columns(starts_on:, ends_on: starts_on + 2)
            item.update_columns(starts_on:, ends_on: starts_on)
            create(:booking, :checkout, listing: tour, user:, trip_item: item, status: "completed", starts_on:,
              ends_on: starts_on)
          end
          booked.call(create(:trip, user:, name: "Camotes"), 90.days.ago.to_date)
          booked.call(create(:trip, user:, name: "Bantayan"), day)
          cancelled = create(:trip, user:, name: "Oslob")
          create(:booking, :checkout, listing: tour, user:, status: "cancelled",
            trip_item: create(:trip_item, trip: cancelled, listing: tour))
          create(:trip, user:, name: "Planning only")
        end

        run_test! do |response|
          body = response.parsed_body
          expect(body.pluck("name")).to eq([ "Bantayan", "Camotes" ])
          expect(body.last["items"].first["booking"]).to include("status" => "completed", "total_cents" => 400_000,
            "to_be_agreed" => false, "expires_at" => nil)
        end
      end

      response "422", "a view that isn't one" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:view) { "all" }

        run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "View must be booked, or left out" ]) }
      end

      response "200", "the guest's trips, up to 7 days after they end" do
        schema type: :array, items: { "$ref" => "#/components/schemas/trip" }

        before do
          later = create(:trip, user:, name: "Siargao weekend", starts_on: day + 30, ends_on: day + 32)
          soon = create(:trip, user:, name: "Bantayan", starts_on: day, ends_on: day + 3)
          create(:trip_item, trip: soon, listing: tour, starts_on: day + 1, ends_on: day + 1, quantity: 2)
          create(:trip_item, trip: soon, listing: tour, starts_on: nil, ends_on: nil)
          create(:trip, :undated, user:, name: "Someday")
          ended = create(:trip, user:, name: "Oslob day trip")
          ended.update_columns(starts_on: 5.days.ago.to_date, ends_on: 3.days.ago.to_date)
          long_ended = create(:trip, user:, name: "Camotes")
          long_ended.update_columns(starts_on: 10.days.ago.to_date, ends_on: 8.days.ago.to_date)
          create(:trip, name: "Someone else's trip")
          later.touch
        end

        run_test! do |response|
          body = response.parsed_body
          expect(body.pluck("name")).to eq([ "Oslob day trip", "Bantayan", "Siargao weekend", "Someday" ])
          expect(body.pluck("deletes_on")).to eq([ 5.days.from_now.to_date.iso8601, nil, nil, nil ])
          body.shift
          expect(body.first).to include("destinations" => [ "Bantayan Island" ], "starts_on" => day.iso8601)
          expect(body.first["items"].pluck("starts_on")).to eq([ (day + 1).iso8601, nil ])
          expect(body.first["items"].first).to include(
            "quantity" => 2, "booking_type" => "rental", "area" => { "slug" => "santa-fe", "name" => "Santa Fe" },
            "destination" => { "slug" => "bantayan-island", "name" => "Bantayan Island" },
            "cancellation_policy" => "free_cancellation", "listing_active" => true
          )
          expect(body.first["items"].first["listing"]).to include("title" => "Island hopping")
        end
      end

      # So the trip can say which nights still need beds: a room's guests times its rooms, a
      # shared room's beds, nothing for anything but a stay.
      response "200", "each stay item with the guests it sleeps, all its units together" do
        schema type: :array, items: { "$ref" => "#/components/schemas/trip" }

        before do
          cottage = create(:listing, :stay, area: santa_fe, title: "Bamboo cottage",
            attrs: { "place_type" => "entire_place", "guests" => 2 })
          rooms = create(:listing, :stay, area: santa_fe, title: "Family rooms",
            attrs: { "place_type" => "private_room", "guests" => 4 })
          rooms.units.create!([ { position: 2 }, { position: 3 } ])
          dorm = create(:listing, :stay, area: santa_fe, title: "Backpacker dorm", with_rate: false,
            attrs: { "place_type" => "shared_room", "guests" => 1 })
          dorm.units.create!((2..6).map { { position: _1 } })
          trip = create(:trip, user:, starts_on: day, ends_on: day + 2)
          [ cottage, rooms, dorm, tour ].each do |listing|
            create(:trip_item, trip:, listing:, starts_on: day, ends_on: day + 2, quantity: 15)
          end
        end

        run_test! do |response|
          items = response.parsed_body.first["items"]
          expect(items.to_h { [ _1["listing"]["title"], _1["sleeps"] ] })
            .to eq("Bamboo cottage" => 2, "Family rooms" => 12, "Backpacker dorm" => 6, "Island hopping" => nil)
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end

    post "Plan a named trip" do
      tags "Trips"
      consumes "application/json"
      produces "application/json"
      description "Guest-only. For guests who plan before adding anything; the first add creates a trip by " \
        "itself (`POST /api/v1/trip_items`). `name` is required (at most 80 characters); dates are optional, " \
        "both or neither, as `YYYY-MM-DD`, and not in the past; `guests` is 1 to 50, default 1."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          name: { type: :string },
          starts_on: { type: :string, format: :date, nullable: true },
          ends_on: { type: :string, format: :date, nullable: true },
          guests: { type: :integer }
        },
        required: %w[name]
      }

      response "201", "the new trip" do
        schema "$ref" => "#/components/schemas/trip"
        let(:body) { { name: "Siargao weekend", starts_on: day.iso8601, ends_on: (day + 2).iso8601, guests: 2 } }

        run_test! do |response|
          expect(response.parsed_body).to include("name" => "Siargao weekend", "guests" => 2, "items" => [])
          expect(user.trips.count).to eq(1)
        end
      end

      response "422", "no name, one date only, or a date that isn't a date" do
        schema "$ref" => "#/components/schemas/validation_errors"

        context "without a name" do
          let(:body) { { starts_on: day.iso8601, ends_on: day.iso8601 } }

          run_test! { |response| expect(response.parsed_body["errors"]).to include("Name is required") }
        end

        context "with one date" do
          let(:body) { { name: "Trip", starts_on: day.iso8601 } }

          run_test! { |response| expect(response.parsed_body["errors"]).to include("A trip needs both dates or neither") }
        end

        context "with a date that isn't one" do
          let(:body) { { name: "Trip", starts_on: "next week", ends_on: 12 } }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to include(
              "Start date must be a date like 2026-11-12", "End date must be a date"
            )
          end
        end

        context "with dates in the past" do
          let(:body) { { name: "Trip", starts_on: 2.days.ago.to_date.iso8601, ends_on: Date.current.iso8601 } }

          run_test! { |response| expect(response.parsed_body["errors"]).to include("Starts on can't be in the past") }
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }
        let(:body) { { name: "Trip" } }

        run_test!
      end
    end
  end

  path "/api/v1/trips/suggestion" do
    get "Which trip an item should go to" do
      tags "Trips"
      produces "application/json"
      description "Guest-only. Preselects a trip in the add sheet. A dated item goes to the trip whose dates are " \
        "nearest its own, overlapping or up to 3 days away (then `extends_to` gives the trip's new dates); a tie " \
        "goes to the trip with an item nearest the listing. An undated item goes to the most recently edited " \
        "trip with the same destination (island, otherwise town or city). Only trips that haven't ended count. " \
        "`trip` null means \"New trip\", which would be named `new_trip_name`."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :listing_id, in: :query, schema: { type: :integer }, required: true
      parameter name: :starts_on, in: :query, schema: { type: :string, format: :date }, required: false
      parameter name: :ends_on, in: :query, schema: { type: :string, format: :date }, required: false

      let(:dive) { create(:listing, area: create(:area, kind: "island", name: "Malapascua")) }
      let(:listing_id) { dive.id }
      let(:starts_on) { (day + 5).iso8601 }
      let(:ends_on) { (day + 5).iso8601 }

      response "200", "a trip within 3 days, extended to take the item" do
        schema "$ref" => "#/components/schemas/trip_suggestion"

        let!(:trip) { create(:trip, user:, starts_on: day, ends_on: day + 3) }

        run_test! do |response|
          expect(response.parsed_body).to include(
            "extends_to" => { "starts_on" => day.iso8601, "ends_on" => (day + 5).iso8601 },
            "new_trip_name" => "Malapascua · #{(day + 5).strftime('%b %-d')}"
          )
          expect(response.parsed_body["trip"]["id"]).to eq(trip.id)
        end
      end

      response "200", "no trip near: a new one" do
        schema "$ref" => "#/components/schemas/trip_suggestion"

        run_test! { |response| expect(response.parsed_body).to include("trip" => nil, "extends_to" => nil) }
      end

      response "422", "a listing that can't be booked" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:listing_id) { create(:listing, :paused).id }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "That listing isn't available to book" ])
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

        run_test!
      end
    end
  end

  path "/api/v1/trips/{id}" do
    parameter name: :id, in: :path, schema: { type: :integer }
    let(:trip) { create(:trip, user:, starts_on: day, ends_on: day + 3) }
    let(:id) { trip.id }

    get "One of the guest's trips" do
      tags "Trips"
      produces "application/json"
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "200", "the trip" do
        schema "$ref" => "#/components/schemas/trip"

        run_test! { |response| expect(response.parsed_body["id"]).to eq(trip.id) }
      end

      response "404", "another guest's trip" do
        schema "$ref" => "#/components/schemas/error"
        let(:trip) { create(:trip) }

        run_test!
      end
    end

    patch "Rename a trip or change its dates or guests" do
      tags "Trips"
      consumes "application/json"
      produces "application/json"
      description "Guest-only. Only the keys sent change; a date not sent keeps its value. Null dates make " \
        "the trip undated. Unbooked items follow: one that spanned the whole trip takes the new dates, one " \
        "the new dates no longer reach becomes undated, and one for the whole group takes the new guests; " \
        "each item's `unavailable` then says whether its listing can still have it. Booked items stay as " \
        "they are, and the dates must still cover them."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          name: { type: :string },
          starts_on: { type: :string, format: :date, nullable: true },
          ends_on: { type: :string, format: :date, nullable: true },
          guests: { type: :integer }
        }
      }

      response "200", "the changed trip" do
        schema "$ref" => "#/components/schemas/trip"
        let(:body) { { name: "Bantayan – Malapascua Escapade", ends_on: (day + 4).iso8601 } }

        run_test! do |response|
          expect(response.parsed_body).to include(
            "name" => "Bantayan – Malapascua Escapade", "starts_on" => day.iso8601, "ends_on" => (day + 4).iso8601
          )
        end
      end

      response "200", "new dates and guests, which a whole-trip item follows onto a day its listing is booked" do
        schema "$ref" => "#/components/schemas/trip"
        let(:van) { create(:listing, area: santa_fe, title: "Van rental") }
        let!(:item) { create(:trip_item, trip:, listing: van, starts_on: day, ends_on: day + 3, quantity: trip.guests) }
        let(:body) { { starts_on: (day - 1).iso8601, ends_on: (day + 3).iso8601, guests: 6 } }

        before { create(:booking, listing: van, starts_on: day - 1, ends_on: day - 1) }

        run_test! do |response|
          expect(response.parsed_body["items"].sole).to include(
            "id" => item.id, "starts_on" => (day - 1).iso8601, "ends_on" => (day + 3).iso8601, "quantity" => 6,
            "unavailable" => "#{(day - 1).strftime('%b %-d')} is fully booked"
          )
        end
      end

      response "422", "dates that no longer cover a booked item" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { starts_on: day.iso8601, ends_on: day.iso8601 } }

        before do
          item = create(:trip_item, trip:, listing: tour, starts_on: day + 2, ends_on: day + 3)
          create(:booking, :checkout, listing: tour, trip_item: item, starts_on: day + 2, ends_on: day + 3, status: "confirmed")
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("The trip's dates must cover the dates of its items")
        end
      end

      response "404", "another guest's trip" do
        schema "$ref" => "#/components/schemas/error"
        let(:trip) { create(:trip) }
        let(:body) { { name: "Mine now" } }

        run_test! { expect(trip.reload.name).not_to eq("Mine now") }
      end
    end

    delete "Delete a trip and its items" do
      tags "Trips"
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "204", "deleted" do
        before { create(:trip_item, trip:) }

        run_test! { expect(Trip.exists?(trip.id)).to be(false) }
      end

      response "404", "another guest's trip" do
        schema "$ref" => "#/components/schemas/error"
        let(:trip) { create(:trip) }

        run_test! { expect(Trip.exists?(trip.id)).to be(true) }
      end
    end
  end

  path "/api/v1/trips/{id}/merge" do
    post "Merge a trip into another" do
      tags "Trips"
      consumes "application/json"
      produces "application/json"
      description "Guest-only. Moves every item into `into_trip_id`, whose dates grow to cover them, and " \
        "deletes this trip. Answers with the trip merged into."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :id, in: :path, schema: { type: :integer }
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { into_trip_id: { type: :integer } }, required: %w[into_trip_id]
      }

      let(:trip) { create(:trip, user:, starts_on: day + 5, ends_on: day + 6) }
      let(:into) { create(:trip, user:, starts_on: day, ends_on: day + 3) }
      let(:id) { trip.id }
      let(:body) { { into_trip_id: into.id } }

      before { create(:trip_item, trip:, starts_on: day + 6, ends_on: day + 6) }

      response "200", "the trip merged into, now with every item" do
        schema "$ref" => "#/components/schemas/trip"

        run_test! do |response|
          expect(response.parsed_body).to include("id" => into.id, "ends_on" => (day + 6).iso8601)
          expect(response.parsed_body["items"].size).to eq(1)
          expect(Trip.exists?(trip.id)).to be(false)
        end
      end

      response "200", "a trip under way merged into a later one: its dates reach back" do
        schema "$ref" => "#/components/schemas/trip"

        before do
          trip.update_columns(starts_on: 1.day.ago.to_date)
          trip.items.first.update_columns(starts_on: 1.day.ago.to_date)
        end

        run_test! { |response| expect(response.parsed_body["starts_on"]).to eq(1.day.ago.to_date.iso8601) }
      end

      response "422", "merged into itself" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { into_trip_id: trip.id } }

        run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "A trip can't be merged into itself" ]) }
      end

      response "404", "into another guest's trip" do
        schema "$ref" => "#/components/schemas/error"
        let(:into) { create(:trip) }

        run_test! { expect(trip.items.count).to eq(1) }
      end
    end
  end

  path "/api/v1/trips/{id}/copy" do
    post "Plan a trip again, from one of the guest's trips" do
      tags "Trips"
      consumes "application/json"
      produces "application/json"
      description "Guest-only (RAA-139). A new trip with this trip's items, each moved by as many days as " \
        "`starts_on` is from this trip's start, with the same guests. Nothing is booked: the items go in the " \
        "cart. `starts_on` is required for a dated trip and can't be in the past; `name` defaults to this " \
        "trip's name with \"again\", `guests` to its guests. An item whose listing can't be booked any more is " \
        "left out and listed in `skipped`."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :id, in: :path, schema: { type: :integer }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          name: { type: :string },
          starts_on: { type: :string, format: :date },
          guests: { type: :integer }
        }
      }

      let(:trip) { create(:trip, user:, name: "Camotes", guests: 3) }
      let(:id) { trip.id }
      let(:paused) { create(:listing, :paused, title: "Sea kayak rental") }
      let(:body) { { starts_on: day.iso8601 } }

      before do
        item = create(:trip_item, trip:, listing: tour, quantity: 2)
        create(:trip_item, trip:, listing: create(:listing)).update_columns(listing_id: paused.id)
        trip.update_columns(starts_on: 30.days.ago.to_date, ends_on: 28.days.ago.to_date)
        item.update_columns(starts_on: 29.days.ago.to_date, ends_on: 28.days.ago.to_date)
      end

      response "201", "the new trip, and the items left out" do
        schema type: :object,
          properties: {
            trip: { "$ref" => "#/components/schemas/trip" },
            skipped: {
              type: :array,
              description: "Items whose listing can't be booked any more",
              items: {
                type: :object,
                properties: { listing_id: { type: :integer }, title: { type: :string }, reason: { type: :string } },
                required: %w[listing_id title reason]
              }
            }
          },
          required: %w[trip skipped]

        run_test! do |response|
          copy = response.parsed_body["trip"]
          expect(copy).to include("name" => "Camotes again", "guests" => 3, "starts_on" => day.iso8601,
            "ends_on" => (day + 2).iso8601)
          expect(copy["items"].map { _1.slice("starts_on", "ends_on", "quantity") }).to eq(
            [ { "starts_on" => (day + 1).iso8601, "ends_on" => (day + 2).iso8601, "quantity" => 2 } ]
          )
          expect(response.parsed_body["skipped"]).to eq(
            [ { "listing_id" => paused.id, "title" => "Sea kayak rental", "reason" => "Isn't available to book any more" } ]
          )
          expect(trip.reload.items.count).to eq(2)
        end
      end

      response "422", "no start date for a dated trip, or one in the past" do
        schema "$ref" => "#/components/schemas/validation_errors"

        context "without a start date" do
          let(:body) { {} }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Start date is required" ]) }
        end

        context "in the past" do
          let(:body) { { starts_on: 1.day.ago.to_date.iso8601 } }

          run_test! { |response| expect(response.parsed_body["errors"]).to include("Starts on can't be in the past") }
        end
      end

      response "404", "another guest's trip" do
        schema "$ref" => "#/components/schemas/error"
        let(:trip) { create(:trip, name: "Theirs") }

        run_test! { expect(Trip.where(name: "Theirs again")).to be_empty }
      end
    end
  end

  path "/api/v1/trips/{id}/quote" do
    get "What a trip's items would cost now" do
      tags "Trips"
      produces "application/json"
      description "Guest-only (RAA-139). Each item priced as checkout would price it now, and checked against " \
        "the listing's calendar; a booked item gives its booking's total. `problem` says why an item can't be " \
        "booked as it is (no date, dates passed or taken, listing off), and such an item has no price. " \
        "`total_cents` adds up the items without a problem; rentals and transfers are priced with the " \
        "partner (`to_be_agreed`) and count ₱0."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :id, in: :path, schema: { type: :integer }

      let(:trip) { create(:trip, user:, starts_on: day, ends_on: day + 3) }
      let(:id) { trip.id }

      response "200", "each item's price or problem, and the total" do
        schema "$ref" => "#/components/schemas/trip_quote"

        let(:stay) { create(:listing, :stay, title: "Kota Beach house") }
        let(:joiner) { create(:listing, :tour, title: "Island hopping") }
        let!(:priced) { create(:trip_item, trip:, listing: joiner, quantity: 2, starts_on: day, ends_on: day) }
        let!(:blocked) { create(:trip_item, trip:, listing: stay, starts_on: day, ends_on: day + 2) }
        let!(:undated) { create(:trip_item, trip:, listing: tour, starts_on: nil, ends_on: nil) }

        before { create(:availability_block, listing: stay, starts_on: day + 1, ends_on: day + 1) }

        run_test! do |response|
          body = response.parsed_body
          expect(body).to include("trip_id" => trip.id, "total_cents" => 300_000, "to_be_agreed_count" => 0)
          expect(body["items"]).to contain_exactly(
            { "trip_item_id" => priced.id, "total_cents" => 300_000, "to_be_agreed" => false, "problem" => nil },
            { "trip_item_id" => blocked.id, "total_cents" => nil, "to_be_agreed" => false,
              "problem" => "#{(day + 1).strftime('%b %-d')} is blocked" },
            { "trip_item_id" => undated.id, "total_cents" => nil, "to_be_agreed" => false,
              "problem" => "Pick a date to book it" }
          )
        end
      end

      response "404", "another guest's trip" do
        schema "$ref" => "#/components/schemas/error"
        let(:trip) { create(:trip) }

        run_test!
      end
    end
  end
end
