require "swagger_helper"

RSpec.describe "Business listings", type: :request do
  let(:day) { 20.days.from_now.to_date }
  let(:area) { create(:area, name: "Santa Fe") }
  let(:click) { create(:listing, :vehicle, area:, title: "Honda Click 125i") }
  let!(:nmax) do
    create(:listing, :vehicle, area:, partner: click.partner, title: "Yamaha NMAX 155",
      attrs: { "make" => "Yamaha", "model" => "NMAX 155", "engine_cc" => 155, "transmission" => "automatic", "seats" => 2 })
  end
  let!(:stay) { create(:listing, :stay, area:, partner: click.partner) }

  before do
    click.units.create!((2..6).map { |position| { position: } })
    create(:booking, listing: click, quantity: 2, starts_on: day, ends_on: day + 1)
    # Picked up on the return day (RAA-195): Nov 3 to Nov 4 takes Nov 3 only.
    create(:booking, listing: click, quantity: 3, starts_on: day + 1, ends_on: day + 2)
    create(:listing, :vehicle, :paused, area:, partner: click.partner, title: "Honda Beat 110")
  end

  path "/api/v1/businesses/{business_id}/listings" do
    get "A business's listings, with what is free on some dates" do
      tags "Discovery"
      produces "application/json"
      description "Public. A business's active listings (RAA-191), by title, for the shop pop-up: a group picks " \
        "how many of each of a motorbike shop's models. `category` (a slug) narrows them. With both dates, " \
        "`units_free` is how many of each one's units are free on all of them, as the partner's calendar has it; " \
        "a model with none free is sold out. Money is in centavos."
      parameter name: :business_id, in: :path, schema: { type: :integer }
      parameter name: :category, in: :query, type: :string, required: false, description: "A category slug, e.g. motorcycle"
      parameter name: :starts_on, in: :query, type: :string, format: :date, required: false
      parameter name: :ends_on, in: :query, type: :string, format: :date, required: false
      parameter name: :pickup_time, in: :query, type: :string, required: false,
        description: "A rental vehicle's pickup (\"08:30\", RAA-195); left out, the shop's default for the day"
      let(:pickup_time) { nil }

      let(:business_id) { click.business_id }
      let(:category) { "motorcycle" }
      let(:starts_on) { day.iso8601 }
      let(:ends_on) { (day + 1).iso8601 }

      response "200", "the shop's motorbikes, each with its units free on the dates" do
        schema type: :object, properties: {
          business: { "$ref" => "#/components/schemas/business_ref" },
          listings: { type: :array, items: { "$ref" => "#/components/schemas/business_listing" } }
        }, required: %w[business listings]

        run_test! do |response|
          body = response.parsed_body
          expect(body["business"]).to eq("id" => click.business_id, "name" => click.business.name)
          expect(body["listings"].map { _1.slice("title", "units_count", "units_free") }).to eq([
            { "title" => "Honda Click 125i", "units_count" => 6, "units_free" => 4 },
            { "title" => "Yamaha NMAX 155", "units_count" => 1, "units_free" => 1 }
          ])
          expect(body["listings"].first["details"]).to include("seats" => 2, "transmission" => "automatic", "engine_cc" => 125)
          expect(body["listings"].first["vehicle_rate"]).to include("daily_price_cents" => 50_000)
        end
      end

      # Counted from the pickup to the return (RAA-195): on day + 1, 2 Clicks are still out until
      # 9:00 (the later rental cancelled, so nothing else is out that day).
      response "200", "a rental's units free from its pickup time to its return" do
        schema type: :object, properties: {
          business: { "$ref" => "#/components/schemas/business_ref" },
          listings: { type: :array, items: { "$ref" => "#/components/schemas/business_listing" } }
        }, required: %w[business listings]
        let(:starts_on) { (day + 1).iso8601 }
        let(:ends_on) { (day + 2).iso8601 }

        before { click.bookings.find_by!(quantity: 3).update_column(:status, "cancelled") }

        context "with a pickup before the first 2 are back" do
          let(:pickup_time) { "08:00" }

          run_test! do |response|
            row = response.parsed_body["listings"].find { _1["id"] == click.id }
            expect(row["units_free"]).to eq(4)
            expect(Time.zone.parse(row["starts_at"])).to eq(Booking.rental_period(day + 1, day + 2, "08:00").begin)
          end
        end

        context "with a pickup once they are back" do
          let(:pickup_time) { "09:00" }

          run_test! { |response| expect(response.parsed_body["listings"].find { _1["id"] == click.id }["units_free"]).to eq(6) }
        end
      end

      response "200", "every active listing without a category; no dates, nothing free counted" do
        schema type: :object, properties: {
          business: { "$ref" => "#/components/schemas/business_ref" },
          listings: { type: :array, items: { "$ref" => "#/components/schemas/business_listing" } }
        }, required: %w[business listings]
        let(:category) { nil }
        let(:starts_on) { nil }
        let(:ends_on) { nil }

        run_test! do |response|
          expect(response.parsed_body["listings"].map { _1["id"] }).to contain_exactly(click.id, nmax.id, stay.id)
          expect(response.parsed_body["listings"].map { _1["units_free"] }.uniq).to eq([ nil ])
        end
      end

      response "422", "bad dates" do
        schema "$ref" => "#/components/schemas/validation_errors"

        context "with one date" do
          let(:ends_on) { nil }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "The listings needs both dates or neither" ]) }
        end

        context "with the end before the start" do
          let(:ends_on) { (day - 1).iso8601 }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "The end date can't be before the start date" ]) }
        end

        context "with a past start" do
          let(:starts_on) { (Date.current - 1).iso8601 }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "The start date can't be in the past" ]) }
        end

        context "with a pickup time off the half hour" do
          let(:pickup_time) { "08:15" }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Pickup time must be a time on the half hour, like 08:30" ]) }
        end
      end

      response "404", "an unknown business" do
        let(:business_id) { 0 }

        run_test!
      end
    end
  end
end
