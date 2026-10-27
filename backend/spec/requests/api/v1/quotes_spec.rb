require "swagger_helper"

RSpec.describe "Quotes", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  before { travel_to Date.new(2026, 10, 1) }

  path "/api/v1/quotes" do
    get "What a stay costs" do
      tags "Discovery"
      produces "application/json"
      description "Public. The price of a stay at an active accommodation listing for the dates and guests, worked " \
        "out from its stay rate (RAA-104): each night at the nightly price, or the weekend price on Friday and " \
        "Saturday nights (a shared room's per guest); each guest above base_guests at the extra-guest fee per " \
        "night; the monthly discount from 28 nights, otherwise the weekly one from 7, off the nights and extra " \
        "guests; then the required fees and the add-ons picked in fee_ids, never discounted. Money is in " \
        "centavos. The dates must be free on the partner's calendar. Several rooms (RAA-182): the party " \
        "(adults, children, infants) goes in the guest's own split (room_guests) or the fewest rooms that sleep it, " \
        "spread evenly, each room priced for the guests taking a bed in it (adults, and children and infants as " \
        "the place counts them); a fee per pet is charged once."
      parameter name: :listing_id, in: :query, type: :integer, required: true
      parameter name: :starts_on, in: :query, type: :string, format: :date, required: true, description: "Check-in"
      parameter name: :ends_on, in: :query, type: :string, format: :date, required: true, description: "Check-out"
      parameter name: :guests, in: :query, type: :integer, required: false, description: "Adults, when adults isn't sent"
      parameter name: :adults, in: :query, type: :integer, required: false
      parameter name: :children, in: :query, type: :integer, required: false, description: "Default 0"
      parameter name: :infants, in: :query, type: :integer, required: false, description: "Default 0"
      parameter name: :pets, in: :query, type: :integer, required: false, description: "Default 0"
      parameter name: :room_guests, in: :query, type: :string, required: false,
        description: "The guest's split as JSON, e.g. [{\"adults\":1},{\"adults\":4,\"children\":1}]; " \
          "it must add up to the party. Left out: the fewest rooms, spread evenly"
      parameter name: "fee_ids[]", in: :query, required: false, description: "Optional fees (add-ons) to include",
        schema: { type: :array, items: { type: :integer } }, style: :form, explode: true

      let(:listing) { create(:listing, :stay) }
      let(:listing_id) { listing.id }
      let(:starts_on) { "2026-11-05" } # A Thursday
      let(:ends_on) { "2026-11-08" }
      let(:guests) { 3 }
      let(:adults) { nil }
      let(:children) { nil }
      let(:infants) { nil }
      let(:pets) { nil }
      let(:room_guests) { nil }
      let(:"fee_ids[]") { nil }

      response "200", "the nights, extra guests, discount and fees" do
        schema "$ref" => "#/components/schemas/stay_quote"

        let(:breakfast) do
          create(:listing_fee, listing:, name: "Breakfast", amount_cents: 25_000, charged_per: "guest_night",
            required: false, position: 2)
        end
        let(:"fee_ids[]") { [ breakfast.id ] }

        before do
          listing.stay_rate.update!(weekend_price_cents: 250_000, extra_guest_fee_cents: 50_000)
          create(:listing_fee, listing:, name: "Cleaning fee", amount_cents: 80_000, position: 1)
        end

        run_test! do |response|
          json = response.parsed_body
          expect(json["nights"]).to eq([
            { "date" => "2026-11-05", "price_cents" => 200_000, "weekend" => false },
            { "date" => "2026-11-06", "price_cents" => 250_000, "weekend" => true },
            { "date" => "2026-11-07", "price_cents" => 250_000, "weekend" => true }
          ])
          expect(json).to include("nights_count" => 3, "nightly_subtotal_cents" => 700_000, "extra_guests" => 1,
            "extra_guests_total_cents" => 150_000, "discount" => nil, "total_cents" => 700_000 + 150_000 + 80_000 + 225_000)
          expect(json["fees"].pluck("name", "quantity", "total_cents")).to eq([
            [ "Cleaning fee", 1, 80_000 ], [ "Breakfast", 9, 225_000 ]
          ])
        end
      end

      response "200", "several rooms: the party spread evenly over the fewest that sleep it" do
        schema "$ref" => "#/components/schemas/stay_quote"

        let(:listing) { create(:listing, :stay, attrs: { "place_type" => "entire_place", "guests" => 5 }) }
        let(:guests) { nil }
        let(:adults) { 8 }
        let(:children) { 2 }

        before { (2..3).each { listing.units.create!(position: _1) } }

        run_test! do |response|
          json = response.parsed_body
          expect(json["rooms"].map { _1.slice("adults", "children", "infants") }).to eq([
            { "adults" => 4, "children" => 1, "infants" => 0 }, { "adults" => 4, "children" => 1, "infants" => 0 }
          ])
          expect(json).to include("guests" => 10, "rooms_free" => 3, "pets" => 0, "total_cents" => 2 * 3 * 200_000)
        end
      end

      response "200", "the guest's own split, each room priced for its guests" do
        schema "$ref" => "#/components/schemas/stay_quote"

        let(:listing) { create(:listing, :stay, attrs: { "place_type" => "entire_place", "guests" => 5 }) }
        let(:guests) { 6 }
        let(:room_guests) { [ { adults: 1 }, { adults: 5 } ].to_json }

        before do
          listing.units.create!(position: 2)
          listing.stay_rate.update!(extra_guest_fee_cents: 50_000)
        end

        run_test! do |response|
          rooms = response.parsed_body["rooms"]
          expect(rooms.pluck("adults", "extra_guests", "total_cents")).to eq([
            [ 1, 0, 600_000 ], [ 5, 3, 600_000 + 450_000 ]
          ])
        end
      end

      response "422", "more guests than the place sleeps, or a stay shorter than its minimum" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:guests) { 5 }

        before { listing.stay_rate.update!(min_nights: 4) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "This place needs a stay of at least 4 nights", "This place sleeps at most 4 guests"
          )
        end
      end

      response "422", "more guests than its rooms sleep, or a split that doesn't fit" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:listing) { create(:listing, :stay, attrs: { "place_type" => "entire_place", "guests" => 5 }) }
        let(:guests) { 16 }

        before { (2..3).each { listing.units.create!(position: _1) } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "This place sleeps at most 15 guests in 3 rooms" ])
        end
      end

      response "422", "a split that isn't a list of rooms" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:room_guests) { "[{\"adults\":\"two\"}]" }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Rooms must be a list of 1 to 99 rooms, each with adults, children and infants" ])
        end
      end

      response "422", "a place with no price yet" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { listing.stay_rate.update_columns(nightly_price_cents: 0) }

        run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "This place has no price yet" ]) }
      end

      response "422", "a listing that isn't priced by the night" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:listing_id) { create(:listing).id }

        run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Only accommodation is priced by the night" ]) }
      end

      response "422", "missing and wrong-typed values" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:starts_on) { "5 Nov" }
        let(:ends_on) { nil }
        let(:guests) { "three" }
        let(:"fee_ids[]") { [ "x" ] }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(
            "Check-in must be a date like 2026-11-12", "Check-out is required", "Guests must be a whole number",
            "Add-ons must be a list of fee ids"
          )
        end
      end

      response "422", "a listing that isn't active" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:listing) { create(:listing, :stay, :paused) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("That listing isn't available to book")
        end
      end
    end
  end
end
