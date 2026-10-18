require "swagger_helper"

RSpec.describe "Checkouts", type: :request do
  let(:user) { create(:user, name: "Ana Reyes") }
  let(:Authorization) { bearer_for(user) }
  let(:day) { 20.days.from_now.to_date }
  let(:trip) { create(:trip, user:, starts_on: day, ends_on: day + 3, guests: 2) }
  # ₱2,000 a night for 2 guests, booked at once.
  let(:stay) { create(:listing, :stay, booking_mode: "instant", cancellation_policy: "seven_days") }
  # ₱1,500 a joiner, on request.
  let(:tour) { create(:listing, :tour, booking_mode: "request") }
  let!(:stay_item) { create(:trip_item, trip:, listing: stay, starts_on: day, ends_on: day + 2, quantity: 1) }
  let!(:tour_item) { create(:trip_item, trip:, listing: tour, starts_on: day + 1, ends_on: day + 1, quantity: 2) }
  let(:item_ids) { [ stay_item.id, tour_item.id ] }
  let(:body) { { trip_id: trip.id, item_ids:, idempotency_key: "checkout-0001" } }

  def check_out(values = {})
    post "/api/v1/checkouts", as: :json, params: body.merge(values), headers: { "Authorization" => Authorization() }
  end

  path "/api/v1/checkouts" do
    post "Book a trip's items" do
      tags "Bookings"
      consumes "application/json"
      produces "application/json"
      description "Guest-only (RAA-132). Books `item_ids` of one of the guest's trips: each item is re-priced and " \
        "checked against the calendar as it is now, all or nothing. An instant-book listing's booking is held for " \
        "payment; a request-to-book one's is a request its partner answers within 24 hours. Both hold their days " \
        "at once. While requests are accepted automatically (no partner inbox yet) and payment is a stub, every " \
        "booking comes back confirmed. Sending the same `idempotency_key` again returns the same checkout."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/checkout_body" }

      response "201", "both booked: the instant one paid, the request accepted then paid" do
        schema "$ref" => "#/components/schemas/checkout"

        run_test! do |response|
          checkout = response.parsed_body
          expect(checkout["total_cents"]).to eq(400_000 + 300_000)
          expect(checkout["bookings"].pluck("listing").pluck("id", "instant_book")).to eq([ [ stay.id, true ], [ tour.id, false ] ])
          expect(checkout["bookings"].pluck("status")).to eq(%w[confirmed confirmed])
          expect(checkout["bookings"].first).to include("guests" => 2, "cancellation_policy" => "seven_days",
            "booking_mode" => "instant", "refund_if_cancelled_cents" => 400_000, "trip_id" => trip.id)

          stay_booking, tour_booking = Booking.order(:starts_on).to_a
          expect(stay_booking.events.pluck(:from_status, :to_status, :actor)).to eq(
            [ [ nil, "awaiting_payment", "guest" ], [ "awaiting_payment", "confirmed", "system" ] ]
          )
          expect(tour_booking.events.pluck(:to_status)).to eq(%w[requested accepted awaiting_payment confirmed])
          expect(stay_booking).to have_attributes(guest_name: "Ana Reyes", source: "checkout", commission_bps: 1000,
            commission_cents: 40_000, trip_item: stay_item)
          expect(Payment.sole).to have_attributes(status: "paid", amount_cents: 700_000)
          expect(stay_item.reload).to be_booked
        end
      end

      response "201", "a request waits for its partner while auto-accept is off, its days held" do
        schema "$ref" => "#/components/schemas/checkout"

        before { allow(Bookings).to receive(:auto_accept?).and_return(false) }

        run_test! do |response|
          expect(response.parsed_body["bookings"].pluck("status")).to eq(%w[confirmed requested])
          request = Booking.requested.sole
          expect(request.expires_at).to be_within(1.minute).of(24.hours.from_now)
          ledger = Availability::Ledger.new([ tour ], day + 1, day + 1)
          expect(ledger.day(tour, day + 1)[:booked]).to eq(2)
        end
      end

      response "201", "sent again with its key: the same checkout" do
        schema "$ref" => "#/components/schemas/checkout"

        before { check_out }

        run_test! do |response|
          expect(response.parsed_body["id"]).to eq(Checkout.sole.id)
          expect(Booking.count).to eq(2)
        end
      end

      response "201", "a rental isn't priced yet: booked at ₱0, to be agreed" do
        schema "$ref" => "#/components/schemas/checkout"

        let(:rental) { create(:listing, booking_mode: "instant") }
        let!(:rental_item) { create(:trip_item, trip:, listing: rental, starts_on: day, ends_on: day + 1) }
        let(:item_ids) { [ rental_item.id ] }

        run_test! do |response|
          expect(response.parsed_body["bookings"].sole).to include("total_cents" => 0, "to_be_agreed" => true,
            "status" => "confirmed")
        end
      end

      response "422", "the stay's dates were taken meanwhile: nothing is booked" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { create(:booking, listing: stay, starts_on: day + 1, ends_on: day + 3) }

        run_test! do |response|
          expect(response.parsed_body["errors"].sole).to start_with("Kota Beach house: Those dates aren't available")
          expect(Booking.count).to eq(1)
          expect(Checkout.count).to eq(0)
        end
      end

      response "422", "a request still waiting holds its seats against another guest" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:item_ids) { [ tour_item.id ] }

        before do
          tour.tour_detail.update!(max_guests: 3, min_guests: 1)
          create(:booking, :checkout, listing: tour, status: "requested", starts_on: day + 1, ends_on: day + 1, quantity: 2)
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Virgin Island hopping: Only 1 left on #{(day + 1).strftime('%b %-d')}" ])
        end
      end

      response "422", "an undated item, one booked already and an unknown key" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let!(:undated) { create(:trip_item, trip:, listing: create(:listing, title: "Kayak"), starts_on: nil, ends_on: nil) }
        let(:item_ids) { [ undated.id, tour_item.id ] }

        before { create(:booking, :checkout, listing: tour, trip_item: tour_item, status: "confirmed") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly("Kayak: pick dates before booking it",
            "Virgin Island hopping is already booked")
        end
      end

      response "422", "items and key of the wrong shape" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { trip_id: trip.id, item_ids: "1,2", idempotency_key: "short" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Items must be a list of the trip's item ids",
            "Idempotency key must be text of 8 to 80 characters" ])
        end
      end

      response "404", "another guest's trip" do
        schema "$ref" => "#/components/schemas/error"

        let(:trip) { create(:trip, starts_on: day, ends_on: day + 3) }

        run_test! { expect(Booking.count).to eq(0) }
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { bearer_for(create(:user, :partner)) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  describe "a booked item" do
    before { check_out }

    it "can't be changed, removed, or deleted with its trip" do
      headers = { "Authorization" => Authorization() }
      patch "/api/v1/trip_items/#{stay_item.id}", as: :json, params: { quantity: 2 }, headers: headers
      expect(response.parsed_body["errors"]).to eq([ "A booked item can't be changed: cancel its booking first" ])

      delete "/api/v1/trip_items/#{stay_item.id}", headers: headers
      expect(response.parsed_body["errors"]).to eq([ "A booked item can't be removed: cancel its booking first" ])

      delete "/api/v1/trips/#{trip.id}", headers: headers
      expect(response).to have_http_status(:unprocessable_content)
      expect(trip.reload.items.count).to eq(2)
    end

    it "shows its booking in the cart, and can be booked again once that is cancelled" do
      get "/api/v1/trips/#{trip.id}", headers: { "Authorization" => Authorization() }
      expect(response.parsed_body["items"].pluck("booking").pluck("status")).to eq(%w[confirmed confirmed])

      Bookings::Cancel.call(stay_item.booking, by: "guest", user:)
      check_out(item_ids: [ stay_item.id ], idempotency_key: "checkout-0002")
      expect(response).to have_http_status(:created)
    end
  end
end
