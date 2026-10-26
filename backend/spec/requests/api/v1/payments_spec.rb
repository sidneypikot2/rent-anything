require "swagger_helper"

RSpec.describe "Payments", type: :request do
  let(:user) { create(:user) }
  let(:Authorization) { bearer_for(user) }
  let(:listing) { create(:listing, :stay) }
  let(:booking) do
    create(:booking, :checkout, listing:, user:, status: "awaiting_payment", expires_at: 20.minutes.from_now)
  end
  let(:payment) { create(:payment, :paymongo, user:, covered_booking_ids: [ booking.id ], amount_cents: booking.total_cents) }
  let(:id) { payment.id }

  before do
    enable_paymongo
    allow(Paymongo).to receive(:checkout_session) { paymongo_session(payment.provider_ref, paid: true) }
  end

  path "/api/v1/payments/{id}" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :id, in: :path, schema: { type: :integer }

    get "One of the guest's payments, with its bookings" do
      tags "Bookings"
      produces "application/json"
      description "Guest-only. Read when the guest comes back from PayMongo's checkout (/cart?payment=<id>). A " \
        "pending payment is first read back from PayMongo, so a payment made is confirmed without waiting for the " \
        "webhook; if PayMongo can't be reached it is answered as it stands. Another guest's payment is a 404."
      security [ { bearer: [] } ]

      response "200", "paid on PayMongo: its bookings confirmed" do
        schema "$ref" => "#/components/schemas/payment_with_bookings"

        run_test! do |response|
          expect(response.parsed_body).to include("status" => "paid", "checkout_url" => nil, "test_mode" => true)
          expect(response.parsed_body["bookings"].pluck("id", "status")).to eq([ [ booking.id, "confirmed" ] ])
        end
      end

      response "200", "PayMongo can't be reached: answered as it stands" do
        schema "$ref" => "#/components/schemas/payment_with_bookings"

        before { allow(Paymongo).to receive(:checkout_session).and_raise(Paymongo::Error, "PayMongo answered 500") }

        run_test! do |response|
          expect(response.parsed_body).to include("status" => "pending", "checkout_url" => payment.checkout_url)
        end
      end

      response "404", "another guest's payment" do
        schema "$ref" => "#/components/schemas/error"

        let(:payment) { create(:payment, :paymongo) }

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
