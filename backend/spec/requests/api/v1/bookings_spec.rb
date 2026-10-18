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
        end
      end

      response "404", "another guest's booking" do
        schema "$ref" => "#/components/schemas/error"

        let(:booking) { create(:booking, :checkout, listing:) }

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
