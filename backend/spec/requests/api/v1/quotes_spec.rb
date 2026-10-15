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
        "centavos. One unit is quoted, and availability isn't checked yet."
      parameter name: :listing_id, in: :query, type: :integer, required: true
      parameter name: :starts_on, in: :query, type: :string, format: :date, required: true, description: "Check-in"
      parameter name: :ends_on, in: :query, type: :string, format: :date, required: true, description: "Check-out"
      parameter name: :guests, in: :query, type: :integer, required: true
      parameter name: "fee_ids[]", in: :query, required: false, description: "Optional fees (add-ons) to include",
        schema: { type: :array, items: { type: :integer } }, style: :form, explode: true

      let(:listing) { create(:listing, :stay) }
      let(:listing_id) { listing.id }
      let(:starts_on) { "2026-11-05" } # A Thursday
      let(:ends_on) { "2026-11-08" }
      let(:guests) { 3 }
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
