require "swagger_helper"

RSpec.describe "Listing prices", type: :request do
  let(:day) { 20.days.from_now.to_date }
  let(:click) do
    create(:listing, :vehicle, title: "Honda Click").tap do |listing|
      listing.units.create!((2..6).map { |position| { position: } })
      listing.vehicle_rate.update!(security_deposit_cents: 100_000)
    end
  end
  let(:camera) { create(:listing, :gear).tap { create(:flat_rate, listing: _1, price_cents: 30_000) } }
  let(:van) { create(:listing, :transfer) }
  let(:tour) { create(:listing, :tour) }
  let(:stay) { create(:listing, :stay) }

  path "/api/v1/listings/{listing_id}/price" do
    get "What adding a listing to a trip would cost" do
      tags "Discovery"
      produces "application/json"
      description "Public. What checkout would charge for a listing on these dates (RAA-191), for any kind: a " \
        "stay's nights, extra guests, discount and fees; a tour's people or groups; a rental vehicle's vehicles " \
        "and days (its refundable deposit apart, never in the total); gear's items and days; a transfer's " \
        "vehicles. `lines` say what the total is made of. Dates or a party that can't be had come back as " \
        "`unavailable`. Money is in centavos."
      parameter name: :listing_id, in: :path, schema: { type: :integer }
      parameter name: :starts_on, in: :query, type: :string, format: :date, required: true
      parameter name: :ends_on, in: :query, type: :string, format: :date, required: true
      parameter name: :quantity, in: :query, type: :integer, required: false,
        description: "The people, or gear's count; default 1"
      parameter name: :units, in: :query, type: :integer, required: false, description: "A rental vehicle's chosen vehicles"
      parameter name: :room_guests, in: :query, type: :string, required: false, description: "A stay's split into rooms, as JSON"
      parameter name: :pets, in: :query, type: :integer, required: false

      let(:listing_id) { click.id }
      let(:starts_on) { day.iso8601 }
      let(:ends_on) { (day + 2).iso8601 }
      let(:quantity) { 10 }

      response "200", "10 people on 2-seat motorbikes: 5 of them for 2 days, the deposit apart" do
        schema "$ref" => "#/components/schemas/listing_price"

        run_test! do |response|
          expect(response.parsed_body).to eq(
            "total_cents" => 500_000, "deposit_cents" => 500_000, "to_be_agreed" => false, "unavailable" => nil,
            "lines" => [ { "label" => "5 motorbikes × ₱500 × 2 days", "amount_cents" => 500_000 } ]
          )
        end
      end

      response "200", "the vehicles the guest chose, more than are free" do
        schema "$ref" => "#/components/schemas/listing_price"
        let(:quantity) { 8 }
        let(:units) { 8 }

        run_test! do |response|
          expect(response.parsed_body).to include("total_cents" => 800_000, "unavailable" => a_string_starting_with("Only 6 left on"))
        end
      end

      response "200", "every other kind: gear, a transfer, a tour and a stay" do
        schema "$ref" => "#/components/schemas/listing_price"

        context "with 2 cameras" do
          let(:listing_id) { camera.id }
          let(:quantity) { 2 }

          run_test! { |response| expect(response.parsed_body).to include("total_cents" => 120_000, "lines" => [ { "label" => "2 × ₱300 × 2 days", "amount_cents" => 120_000 } ]) }
        end

        context "with a van" do
          let(:listing_id) { van.id }

          run_test! { |response| expect(response.parsed_body).to include("total_cents" => 150_000, "lines" => [ { "label" => "1 × ₱1,500 a trip", "amount_cents" => 150_000 } ]) }
        end

        context "with a joiner tour for 3" do
          let(:listing_id) { tour.id }
          let(:quantity) { 3 }

          run_test! { |response| expect(response.parsed_body).to include("total_cents" => 450_000, "lines" => [ { "label" => "3 people × ₱1,500", "amount_cents" => 450_000 } ]) }
        end

        context "with a stay for 2" do
          let(:listing_id) { stay.id }
          let(:quantity) { 2 }

          run_test! { |response| expect(response.parsed_body).to include("total_cents" => 400_000, "lines" => [ { "label" => "2 nights", "amount_cents" => 400_000 } ]) }
        end

        context "with gear that has no price yet" do
          let(:listing_id) { create(:listing, :gear).id }

          run_test! { |response| expect(response.parsed_body).to include("total_cents" => 0, "to_be_agreed" => true, "lines" => []) }
        end
      end

      response "422", "missing or bad dates" do
        schema "$ref" => "#/components/schemas/validation_errors"

        context "with no end date" do
          let(:ends_on) { nil }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "End date is required" ]) }
        end

        context "with the end before the start" do
          let(:ends_on) { (day - 1).iso8601 }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "The end date can't be before the start date" ]) }
        end
      end

      response "404", "a listing that isn't live" do
        let(:listing_id) { create(:listing, :vehicle, :paused).id }

        run_test!
      end
    end
  end
end
