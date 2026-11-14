require "swagger_helper"

RSpec.describe "Listing availability", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:day) { 20.days.from_now.to_date }
  let(:bike) { create(:listing, :vehicle).tap { |listing| listing.units.create!(position: 2) } }
  let(:listing_id) { bike.id }
  let(:from) { day.iso8601 }
  let(:to) { (day + 3).iso8601 }

  path "/api/v1/listings/{listing_id}/availability" do
    get "A listing's units free, day by day" do
      tags "Discovery"
      produces "application/json"
      description "Public. How many of a listing's units are free on each day from `from` to `to` (at most " \
        "#{Availability::Days::MAX_DAYS} days), as the partner's calendar counts them (RAA-315): the booking card's " \
        "calendar shows them and greys out the days with none. A vehicle or gear rental has none today once the " \
        "shop's last pickup has gone."
      parameter name: :listing_id, in: :path, schema: { type: :integer }
      parameter name: :from, in: :query, type: :string, format: :date, required: true
      parameter name: :to, in: :query, type: :string, format: :date, required: true

      response "200", "each day's units free: a booked day and a blocked one have none" do
        schema "$ref" => "#/components/schemas/listing_availability"

        before do
          create(:booking, listing: bike, starts_on: day + 1, ends_on: day + 2, quantity: 2)
          create(:booking, listing: bike, starts_on: day + 2, ends_on: day + 3, quantity: 1)
          bike.availability_blocks.create!(starts_on: day + 3, ends_on: day + 3)
        end

        run_test! do |response|
          expect(response.parsed_body["days"]).to eq([
            { "date" => day.iso8601, "units_free" => 2 },
            { "date" => (day + 1).iso8601, "units_free" => 0 },
            { "date" => (day + 2).iso8601, "units_free" => 1 },
            { "date" => (day + 3).iso8601, "units_free" => 0 }
          ])
        end
      end

      response "200", "a rental today once the shop's last pickup has gone: none" do
        schema "$ref" => "#/components/schemas/listing_availability"
        let(:from) { Date.new(2026, 11, 2).iso8601 }
        let(:to) { Date.new(2026, 11, 3).iso8601 }

        # 8:10 PM in Manila.
        before { travel_to Time.utc(2026, 11, 2, 12, 10) }

        run_test! do |response|
          expect(response.parsed_body["days"].map { _1["units_free"] }).to eq([ 0, 2 ])
        end
      end

      response "404", "a listing that isn't live" do
        let(:listing_id) { create(:listing, :vehicle, :paused).id }

        run_test!
      end

      response "422", "dates missing, past, the wrong way round or too far apart" do
        context "with the end first" do
          let(:to) { (day - 1).iso8601 }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "To can't be before from" ]) }
        end

        context "with a past start" do
          let(:from) { (Date.current - 1).iso8601 }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "From can't be in the past" ]) }
        end

        context "with too many days" do
          let(:to) { (day + 100).iso8601 }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Ask for at most 92 days at a time" ]) }
        end
      end
    end
  end
end
