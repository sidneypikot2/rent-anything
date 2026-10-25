require "swagger_helper"

RSpec.describe "Admin bookings", type: :request do
  let(:user) { create(:user, :admin) }
  let(:Authorization) { bearer_for(user) }
  let(:partner) { create(:user, :partner, name: "Lito Partner", phone: "+639170000001", email: "lito@example.com") }
  let(:listing) { create(:listing, :stay, partner:, business: create(:business, partner:, name: "Kota Stays")) }
  let(:traveller) { create(:user, name: "Ana Guest", email: "ana@example.com", phone: "+639170000002") }

  path "/api/v1/admin/bookings" do
    parameter name: :Authorization, in: :header, schema: { type: :string }

    get "Every partner's bookings, for the team to answer" do
      tags "Admin"
      produces "application/json"
      description "Admin-only (RAA-141). The team answers booking requests on partners' behalf. `status` picks " \
        "one status (default `requested`: soonest to expire first) or `all` (newest first); at most 200. Each " \
        "comes with its listing and booking type, its partner and business, and its traveller's contact details."
      security [ { bearer: [] } ]
      parameter name: :status, in: :query, required: false, schema: {
        type: :string, enum: Booking::STATUSES + [ "all" ]
      }

      let(:status) { nil }
      let!(:later) do
        create(:booking, :checkout, listing:, user: traveller, status: "requested", guest_name: "Later",
          expires_at: 20.hours.from_now, notes: "Late arrival")
      end
      let!(:sooner) do
        create(:booking, :checkout, listing:, status: "requested", guest_name: "Sooner", expires_at: 2.hours.from_now)
      end
      let!(:offline) { create(:booking, listing:, guest_name: "Offline") }

      response "200", "the requests to answer, soonest to expire first" do
        schema type: :array, items: { "$ref" => "#/components/schemas/admin_booking" }

        run_test! do |response|
          expect(response.parsed_body.pluck("guest_name")).to eq(%w[Sooner Later])
          expect(response.parsed_body.last).to include(
            "booking_type" => "stay", "notes" => "Late arrival",
            "listing" => { "id" => listing.id, "title" => listing.title, "area" => listing.area.name },
            "partner" => { "id" => partner.id, "name" => "Lito Partner", "email" => "lito@example.com",
              "phone" => "+639170000001", "business" => "Kota Stays" },
            "traveller" => { "id" => traveller.id, "name" => "Later", "email" => "ana@example.com",
              "phone" => "+639170000002" }
          )
        end
      end

      response "200", "all of them, newest first; one taken offline has no traveller" do
        schema type: :array, items: { "$ref" => "#/components/schemas/admin_booking" }

        let(:status) { "all" }

        run_test! do |response|
          expect(response.parsed_body.pluck("guest_name")).to eq(%w[Offline Sooner Later])
          expect(response.parsed_body.first["traveller"]).to be_nil
        end
      end

      response "200", "one status" do
        schema type: :array, items: { "$ref" => "#/components/schemas/admin_booking" }

        let(:status) { "confirmed" }

        run_test! { |response| expect(response.parsed_body.pluck("guest_name")).to eq(%w[Offline]) }
      end

      response "422", "a status that doesn't exist" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:status) { "pending" }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { partner }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/admin/bookings/{id}" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :id, in: :path, schema: { type: :integer }

    patch "Accept or decline a request on its partner's behalf" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only (RAA-141). `accepted` holds it for the guest's payment (awaiting_payment, RAA-143) " \
        "until they pay or its pay-by time passes; `declined` frees its days. Recorded as the team's answer (actor `admin`), with an optional " \
        "`reason`. A request past its answer-by time has expired, and one already answered can't be answered again."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          status: { type: :string, enum: Bookings::Respond::DECISIONS },
          reason: { type: :string, description: "Why, up to 500 characters; kept on the booking's history" }
        },
        required: %w[status]
      }

      let(:booking) do
        create(:booking, :checkout, listing:, status: "requested", booking_mode: "request", expires_at: 1.hour.from_now)
      end
      let(:id) { booking.id }
      let(:body) { { status: "accepted" } }

      response "200", "accepted: held for the guest's payment, and recorded as the team's" do
        schema "$ref" => "#/components/schemas/admin_booking"

        run_test! do |response|
          expect(response.parsed_body["status"]).to eq("awaiting_payment")
          expect(booking.events.pluck(:to_status, :actor, :user_id)).to eq([ [ "accepted", "admin", user.id ],
            [ "awaiting_payment", "system", nil ] ])
          expect(booking.reload.payment).to be_nil
        end
      end

      response "200", "declined, with a reason" do
        schema "$ref" => "#/components/schemas/admin_booking"

        let(:body) { { status: "declined", reason: "Partner is fully booked" } }

        run_test! do |response|
          expect(response.parsed_body["status"]).to eq("declined")
          expect(booking.events.last).to have_attributes(actor: "admin", reason: "Partner is fully booked")
        end
      end

      response "422", "a request answered too late has expired" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:booking) { create(:booking, :checkout, listing:, status: "requested", expires_at: 1.minute.ago) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "This request has expired" ])
          expect(booking.reload).to be_expired
        end
      end

      response "422", "a request already answered" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:booking) { create(:booking, :checkout, listing:) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "A booking that is confirmed can't be accepted" ])
        end
      end

      response "422", "a status other than an answer" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { status: "cancelled" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "A request can be accepted or declined" ])
          expect(booking.reload).to be_requested
        end
      end

      response "422", "a reason that isn't text" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { status: "declined", reason: { why: "no" } } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Reason must be text of at most 500 characters" ])
          expect(booking.reload).to be_requested
        end
      end

      response "404", "no such booking" do
        schema "$ref" => "#/components/schemas/error"

        let(:id) { 0 }

        run_test!
      end

      response "403", "the booking's own partner, at the admin endpoint" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { partner }

        run_test! { expect(booking.reload).to be_requested }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
