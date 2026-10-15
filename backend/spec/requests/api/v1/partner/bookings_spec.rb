require "swagger_helper"

RSpec.describe "Partner bookings", type: :request do
  let(:user) { create(:user, :partner) }
  let(:Authorization) { bearer_for(user) }
  let(:today) { Date.current }
  let(:listing) { create(:listing, :stay, partner: user) }
  let(:listing_id) { listing.id }
  let(:body) do
    { guest_name: "  Ana Reyes ", starts_on: (today + 1).iso8601, ends_on: (today + 3).iso8601, quantity: 2,
      total_cents: 800_000, notes: "Paid by GCash" }
  end

  before { listing.units.create!(position: 2) }

  def book(values)
    post "/api/v1/partner/listings/#{listing_id}/bookings", as: :json, params: body.merge(values),
      headers: { "Authorization" => Authorization() }
  end

  def on(days) = (today + days).strftime("%b %-d")

  path "/api/v1/partner/listings/{listing_id}/bookings" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :listing_id, in: :path, schema: { type: :integer }

    get "A listing's bookings" do
      tags "Partner"
      produces "application/json"
      description "Partner-only (RAA-118). The listing's bookings ending today or later, cancelled ones too, by start " \
        "date."
      security [ { bearer: [] } ]

      response "200", "the bookings still to come" do
        schema type: :array, items: { "$ref" => "#/components/schemas/booking" }

        before do
          create(:booking, listing:, guest_name: "Later", starts_on: today + 5, ends_on: today + 6, status: "cancelled")
          create(:booking, listing:, guest_name: "Now", starts_on: today - 1, ends_on: today)
          create(:booking, listing:, guest_name: "Gone", starts_on: today - 4, ends_on: today - 1)
        end

        run_test! { |response| expect(response.parsed_body.pluck("guest_name")).to eq(%w[Now Later]) }
      end

      response "404", "another partner's listing" do
        schema "$ref" => "#/components/schemas/error"

        let(:listing) { create(:listing, :stay) }

        run_test!
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user) }
        let(:listing) { create(:listing, :stay) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end

    post "Add a booking taken offline" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only (RAA-118). A booking the partner took outside the app, so the calendar counts it. " \
        "A stay's dates are check-in and check-out. Refused on a blocked day or one without `quantity` units left, " \
        "and for a stay shorter than its check-in day's minimum nights or longer than the listing's maximum."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/offline_booking_body" }

      response "201", "booked; the nights fill up" do
        schema "$ref" => "#/components/schemas/booking"

        run_test! do |first|
          expect(first.parsed_body).to include("guest_name" => "Ana Reyes", "quantity" => 2, "status" => "confirmed",
            "source" => "offline", "total_cents" => 800_000)
          # Check-out day is free; the nights before are full.
          book(starts_on: (today + 3).iso8601, ends_on: (today + 4).iso8601)
          expect(response).to have_http_status(:created)
          book(starts_on: (today + 2).iso8601, ends_on: (today + 3).iso8601, quantity: 1)
          expect(response.parsed_body["errors"]).to eq([ "#{on(2)} is fully booked" ])
        end
      end

      response "201", "a day booking takes its last day too" do
        schema "$ref" => "#/components/schemas/booking"

        let(:listing) { create(:listing, partner: user) }
        let(:body) do
          { guest_name: "Ana", starts_on: (today + 1).iso8601, ends_on: (today + 1).iso8601, quantity: 1, total_cents: 0 }
        end

        run_test! do
          book(quantity: 2)
          expect(response.parsed_body["errors"]).to eq([ "Only 1 left on #{on(1)}" ])
        end
      end

      response "422", "a blocked day, too few units, or too short a stay" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before do
          create(:availability_block, listing:, starts_on: today + 2, ends_on: today + 2)
          create(:listing_day, listing:, date: today + 5, units_available: 1, min_nights: 3, price_cents: nil)
        end

        run_test! do |first|
          expect(first.parsed_body["errors"]).to eq([ "#{on(2)} is blocked" ])
          book(starts_on: (today + 5).iso8601, ends_on: (today + 8).iso8601)
          expect(response.parsed_body["errors"]).to eq([ "Only 1 left on #{on(5)}" ])
          book(starts_on: (today + 5).iso8601, ends_on: (today + 7).iso8601, quantity: 1)
          expect(response.parsed_body["errors"]).to eq([ "Stays checking in that day are at least 3 nights" ])
          expect(listing.bookings.count).to eq(0)
        end
      end

      response "422", "missing or wrong values" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) do
          { guest_name: "", starts_on: (today - 1).iso8601, ends_on: (today - 1).iso8601, quantity: "2", total_cents: -1,
            notes: "x" * 501 }
        end

        run_test! do |first|
          expect(first.parsed_body["errors"]).to eq([
            "Guest name is required", "Check-in can't be in the past", "Check-out must be after check-in",
            "Quantity must be a whole number from 1 to 99", "Total must be a whole number of centavos, 0 or more",
            "Notes can be at most 500 characters"
          ])
        end
      end

      response "404", "another partner's listing" do
        schema "$ref" => "#/components/schemas/error"

        let(:listing) { create(:listing, :stay) }

        run_test! { expect(Booking.count).to eq(0) }
      end
    end
  end

  path "/api/v1/partner/listings/{listing_id}/bookings/{id}" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :listing_id, in: :path, schema: { type: :integer }
    parameter name: :id, in: :path, schema: { type: :integer }

    let(:booking) { create(:booking, listing:, quantity: 2) }
    let(:id) { booking.id }
    let(:body) { { status: "cancelled" } }

    patch "Cancel a booking" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only (RAA-118). Cancelling frees the booking's days; a cancelled booking stays cancelled."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/booking_status_body" }

      response "200", "cancelled; the days are free again" do
        schema "$ref" => "#/components/schemas/booking"

        run_test! do
          expect(booking.reload).to be_cancelled
          book(guest_name: "Ana", starts_on: booking.starts_on.iso8601, ends_on: booking.ends_on.iso8601, quantity: 2,
            total_cents: 0)
          expect(response).to have_http_status(:created)
        end
      end

      response "422", "anything but cancelling" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { status: "confirmed" } }

        run_test! do |first|
          expect(first.parsed_body["errors"]).to eq([ "A booking can only be cancelled" ])
          expect(booking.reload).to be_confirmed
        end
      end

      response "404", "another partner's booking" do
        schema "$ref" => "#/components/schemas/error"

        let(:booking) { create(:booking) }

        run_test! { expect(booking.reload).to be_confirmed }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user) }
        let(:listing) { create(:listing, :stay) }

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
