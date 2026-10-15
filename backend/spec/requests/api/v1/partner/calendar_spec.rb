require "swagger_helper"

RSpec.describe "Partner calendar", type: :request do
  let(:user) { create(:user, :partner) }
  let(:Authorization) { bearer_for(user) }
  let(:today) { Date.current }
  let(:from) { today.iso8601 }
  let(:to) { (today + 6).iso8601 }

  path "/api/v1/partner/calendar" do
    get "The partner's calendar" do
      tags "Partner"
      produces "application/json"
      description "Partner-only (RAA-118). Every one of the partner's listings, by business, category and title, " \
        "with each day from `from` to `to` (at most 92 days): its price, units on sale, units booked and left, a " \
        "stay's minimum nights and any block; and the blocks and confirmed bookings touching the window. A stay's " \
        "booking takes the nights from check-in to the night before check-out."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :from, in: :query, schema: { type: :string, format: :date }, required: true
      parameter name: :to, in: :query, schema: { type: :string, format: :date }, required: true

      response "200", "each listing's days, blocks and bookings" do
        schema "$ref" => "#/components/schemas/partner_calendar"

        let(:resort) { create(:business, partner: user, name: "Amihan Resort") }
        let(:stay) { create(:listing, :stay, partner: user, business: resort, title: "Garden room") }
        let(:tour) { create(:listing, :tour, partner: user, business: resort, title: "Island hopping") }

        before do
          stay.units.create!(position: 2)
          stay.units.create!(position: 3)
          tour.tour_detail.update!(max_groups_per_day: 4)
          create(:listing, :stay, title: "Someone else's room")
          create(:listing_day, listing: stay, date: today + 1, price_cents: 260_000, units_available: 2)
          create(:availability_block, listing: stay, starts_on: today + 4, ends_on: today + 5, reason: "Repainting")
          create(:booking, listing: stay, starts_on: today + 1, ends_on: today + 3, quantity: 1)
          create(:booking, listing: stay, starts_on: today + 2, ends_on: today + 3, quantity: 2)
          create(:booking, listing: stay, starts_on: today + 1, ends_on: today + 2, status: "cancelled")
          create(:booking, listing: tour, starts_on: today, ends_on: today, quantity: 3)
        end

        run_test! do |response|
          body = response.parsed_body
          expect(body["listings"].pluck("title")).to eq([ "Garden room", "Island hopping" ])
          room, hopping = body["listings"]
          expect(room).to include("capacity" => 3, "price_unit" => "night")
          expect(room["days"].size).to eq(7)
          expect(room["days"][1]).to include(
            "price_cents" => 260_000, "price_set" => true, "units_available" => 2, "units_set" => true,
            "booked" => 1, "units_left" => 1, "min_nights" => 1, "min_nights_set" => false, "block_id" => nil
          )
          # Check-out on day 3: that night isn't taken.
          expect(room["days"].pluck("booked")).to eq([ 0, 1, 3, 0, 0, 0, 0 ])
          expect(room["days"][2]).to include("price_cents" => 200_000, "price_set" => false, "units_left" => 0)
          expect(room["days"][4]).to include("units_left" => 0, "block_id" => room["blocks"].first["id"])
          expect(room["blocks"]).to match([ hash_including("reason" => "Repainting") ])
          expect(room["bookings"].pluck("quantity")).to eq([ 1, 2 ])
          expect(hopping).to include("capacity" => 4, "price_unit" => "person")
          expect(hopping["days"].first).to include("booked" => 3, "units_left" => 1, "min_nights" => nil,
            "price_cents" => 150_000)
        end
      end

      response "422", "dates missing, backwards or too far apart" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:to) { (today + 92).iso8601 }

        run_test! do |first|
          expect(first.parsed_body["errors"]).to eq([ "Ask for at most 92 days at a time" ])
          [ [ { from: }, "To is required" ], [ { from:, to: "soon" }, "To must be a date like 2026-11-12" ],
            [ { from: to, to: from }, "To can't be before from" ] ].each do |query, message|
            get "/api/v1/partner/calendar", params: query, headers: { "Authorization" => Authorization() }
            expect(response.parsed_body["errors"]).to eq([ message ])
          end
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
  end
end
