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
        "destination and dates (\"Bantayan Island · Nov 12–15\") with `quantity` guests. The trip's dates grow " \
        "to cover the item's. Dates are optional, both or neither, `YYYY-MM-DD` and not in the past: an " \
        "undated item can't be checked out until it has one. `quantity` is 1 to 99, default 1. Answers with " \
        "the trip."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          listing_id: { type: :integer },
          starts_on: { type: :string, format: :date, nullable: true },
          ends_on: { type: :string, format: :date, nullable: true },
          quantity: { type: :integer },
          trip_id: { type: :integer, nullable: true, description: "Omit or null for a new trip" }
        },
        required: %w[listing_id]
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

      response "201", "an add to an existing trip extends its dates" do
        schema "$ref" => "#/components/schemas/trip"
        let(:trip) { create(:trip, user:, starts_on: day, ends_on: day + 3) }
        let(:body) { { listing_id: tour.id, starts_on: (day + 5).iso8601, ends_on: (day + 5).iso8601, trip_id: trip.id } }

        run_test! do |response|
          expect(response.parsed_body).to include("id" => trip.id, "ends_on" => (day + 5).iso8601)
          expect(response.parsed_body["items"].size).to eq(1)
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
          quantity: { type: :integer },
          move_to_trip_id: { type: :integer }
        }
      }

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

        run_test! do |response|
          expect(response.parsed_body).to include("id" => other.id, "starts_on" => day.iso8601)
          expect(trip.items.count).to eq(0)
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
