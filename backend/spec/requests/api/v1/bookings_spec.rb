require "swagger_helper"

RSpec.describe "Bookings", type: :request do
  let(:user) { create(:user) }
  let(:Authorization) { bearer_for(user) }
  let(:today) { Date.current }
  let(:listing) { create(:listing, :stay, cancellation_policy: "seven_days") }

  def guest_booking(**values)
    create(:booking, :checkout, listing:, user:, **values)
  end

  path "/api/v1/bookings" do
    parameter name: :Authorization, in: :header, schema: { type: :string }

    get "The guest's bookings" do
      tags "Bookings"
      produces "application/json"
      description "Guest-only (RAA-132). Upcoming bookings (those holding their days, pending ones too) first by " \
        "date, then past, cancelled, declined and expired ones, newest first."
      security [ { bearer: [] } ]

      response "200", "upcoming first, then the rest" do
        schema type: :array, items: { "$ref" => "#/components/schemas/guest_booking" }

        before do
          guest_booking(starts_on: today + 9, ends_on: today + 10, guest_name: "later")
          guest_booking(starts_on: today + 2, ends_on: today + 4, status: "requested", guest_name: "soon")
          guest_booking(starts_on: today + 5, ends_on: today + 6, status: "cancelled", guest_name: "cancelled")
          guest_booking(starts_on: today - 6, ends_on: today - 4, status: "completed", guest_name: "past")
          create(:booking, :checkout, listing:, starts_on: today + 3, ends_on: today + 4)
        end

        run_test! do |response|
          ids = Booking.where(user:).order(:id).ids
          expect(response.parsed_body.pluck("id")).to eq([ ids[1], ids[0], ids[2], ids[3] ])
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
  end

  path "/api/v1/bookings/{id}" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :id, in: :path, schema: { type: :integer }

    get "One of the guest's bookings, with its history" do
      tags "Bookings"
      produces "application/json"
      description "Guest-only (RAA-132). Another guest's booking is a 404."
      security [ { bearer: [] } ]

      let(:id) { booking.id }

      response "200", "the booking" do
        schema "$ref" => "#/components/schemas/guest_booking"

        let(:booking) do
          booking = guest_booking(status: "awaiting_payment")
          Bookings::Transition.record_start(booking, actor: "guest", user:)
          Bookings::Transition.call(booking, "confirmed", actor: "system")
        end

        run_test! do |response|
          expect(response.parsed_body["events"].pluck("to_status")).to eq(%w[awaiting_payment confirmed])
          # Booked under seven_days: free to cancel until 7 days before it starts.
          expect(response.parsed_body["free_cancellation_until"]).to eq((booking.starts_on - 7).iso8601)
        end
      end

      response "404", "another guest's booking" do
        schema "$ref" => "#/components/schemas/error"

        let(:booking) { create(:booking, :checkout, listing:) }

        run_test!
      end
    end

    patch "Change one of the guest's bookings" do
      tags "Bookings"
      consumes "application/json"
      produces "application/json"
      description "Guest-only (RAA-134). New dates or guests for a booking that holds its days and hasn't started " \
        "(requested, accepted, awaiting_payment or confirmed); a key left out keeps what it has. It is re-priced and " \
        "checked against the calendar, its own days left free to it, and goes back to the partner as a request: " \
        "requested, holding its new days until the partner answers. Its trip item takes the same dates and guests."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/booking_change_body" }

      let(:item) { create(:trip_item, trip: create(:trip, user:), listing:, starts_on: today + 10, ends_on: today + 12) }
      let(:booking) { guest_booking(trip_item: item, starts_on: today + 10, ends_on: today + 12) }
      let(:id) { booking.id }
      let(:body) { { starts_on: (today + 11).iso8601, ends_on: (today + 14).iso8601, guests: 3 } }

      response "200", "changed: a request again, over days it partly held already" do
        schema "$ref" => "#/components/schemas/guest_booking"

        run_test! do |response|
          expect(response.parsed_body).to include("status" => "requested", "starts_on" => (today + 11).iso8601,
            "ends_on" => (today + 14).iso8601, "guests" => 3, "total_cents" => 600_000)
          expect(response.parsed_body["expires_at"]).to be_present
          expect(booking.events.last).to have_attributes(from_status: "confirmed", to_status: "requested", actor: "guest",
            reason: "Changed by the guest")
          expect(item.reload).to have_attributes(starts_on: today + 11, ends_on: today + 14, quantity: 3)
          expect(item.trip.reload.ends_on).to eq(today + 14)
        end
      end

      response "422", "those days are taken" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { create(:booking, :checkout, listing:, starts_on: today + 13, ends_on: today + 15) }

        run_test! do |response|
          expect(response.parsed_body["errors"].first).to match(/Kota Beach house: .*#{(today + 13).strftime("%b %-d")}/)
          expect(booking.reload).to have_attributes(status: "confirmed", starts_on: today + 10)
        end
      end

      response "422", "already under way" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:booking) { guest_booking(starts_on: today, ends_on: today + 2, status: "in_progress") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "A booking that is in progress can't be changed" ])
        end
      end

      response "422", "guests not a number" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { guests: "3" } }

        run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Guests must be a whole number" ]) }
      end

      response "404", "another guest's booking" do
        schema "$ref" => "#/components/schemas/error"

        let(:booking) { create(:booking, :checkout, listing:, starts_on: today + 10, ends_on: today + 12) }

        run_test! { expect(booking.reload).to be_confirmed }
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { bearer_for(create(:user, :partner)) }

        run_test! { expect(booking.reload).to be_confirmed }
      end
    end
  end

  path "/api/v1/bookings/pay" do
    parameter name: :Authorization, in: :header, schema: { type: :string }

    post "Pay for the guest's accepted bookings" do
      tags "Bookings"
      consumes "application/json"
      produces "application/json"
      description "Guest-only (RAA-143). Pays for bookings held for payment (awaiting_payment: accepted by their " \
        "partner, or instant) and confirms them, with one payment per checkout they came from. Every booking " \
        "must be the guest's and still held, or nothing is paid. Payment is a stub until Xendit replaces it."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/booking_pay_body" }

      let(:held) { guest_booking(status: "awaiting_payment", expires_at: 1.hour.from_now) }
      let(:other_checkout) do
        guest_booking(status: "awaiting_payment", expires_at: 1.hour.from_now, starts_on: today + 5, ends_on: today + 6)
      end
      let(:body) { { booking_ids: [ held.id, other_checkout.id ] } }

      response "200", "paid and confirmed, one payment per checkout" do
        schema type: :array, items: { "$ref" => "#/components/schemas/guest_booking" }

        run_test! do |response|
          expect(response.parsed_body.pluck("status")).to eq(%w[confirmed confirmed])
          expect(Payment.where(status: "paid").pluck(:checkout_id)).to contain_exactly(held.checkout_id,
            other_checkout.checkout_id)
          expect(held.reload.payment).to have_attributes(amount_cents: held.total_cents)
        end
      end

      response "422", "one is not held for payment" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:requested) { guest_booking(status: "requested", starts_on: today + 5, ends_on: today + 6) }
        let(:body) { { booking_ids: [ held.id, requested.id ] } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "A booking that is requested can't be paid for" ])
          expect(held.reload).to be_awaiting_payment
          expect(Payment.count).to eq(0)
        end
      end

      response "422", "past its pay-by time" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:held) { guest_booking(status: "awaiting_payment", expires_at: 1.minute.ago) }
        let(:body) { { booking_ids: [ held.id ] } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "This booking wasn't paid for in time" ])
          expect(held.reload).to be_expired
        end
      end

      response "422", "no bookings" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { booking_ids: [] } }

        run_test!
      end

      response "404", "another guest's booking" do
        schema "$ref" => "#/components/schemas/error"

        let(:theirs) { create(:booking, :checkout, listing:, status: "awaiting_payment", expires_at: 1.hour.from_now) }
        let(:body) { { booking_ids: [ held.id, theirs.id ] } }

        run_test! { expect(theirs.reload).to be_awaiting_payment }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }
        let(:body) { { booking_ids: [] } }

        run_test!
      end
    end
  end

  path "/api/v1/bookings/{id}/cancel" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :id, in: :path, schema: { type: :integer }

    post "Cancel one of the guest's bookings" do
      tags "Bookings"
      consumes "application/json"
      produces "application/json"
      description "Guest-only (RAA-132). Cancels a booking that hasn't started, freeing its days, with what the " \
        "guest gets back by the cancellation policy it was booked under (refund_if_cancelled_cents said so " \
        "beforehand). Refunds are recorded only until payments are real."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/booking_cancel_body" }

      let(:body) { { reason: "Plans changed" } }
      let(:booking) { guest_booking(starts_on: today + 10, ends_on: today + 12) }
      let(:id) { booking.id }

      response "200", "cancelled 7 days or more before: refunded in full" do
        schema "$ref" => "#/components/schemas/guest_booking"

        run_test! do |response|
          expect(response.parsed_body).to include("status" => "cancelled", "cancelled_by" => "guest",
            "refund_cents" => 400_000, "cancellable" => false)
          expect(booking.events.last).to have_attributes(actor: "guest", user_id: user.id, reason: "Plans changed")
        end
      end

      response "200", "cancelled within 7 days: no refund" do
        schema "$ref" => "#/components/schemas/guest_booking"

        let(:booking) { guest_booking(starts_on: today + 3, ends_on: today + 5) }

        run_test! { |response| expect(response.parsed_body["refund_cents"]).to eq(0) }
      end

      response "422", "already under way" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:booking) { guest_booking(starts_on: today, ends_on: today + 2, status: "in_progress") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "A booking that is in progress can't be cancelled" ])
        end
      end

      response "404", "another guest's booking" do
        schema "$ref" => "#/components/schemas/error"

        let(:booking) { create(:booking, :checkout, listing:) }

        run_test! { expect(booking.reload).to be_confirmed }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
