require "swagger_helper"

RSpec.describe "PayMongo webhook", type: :request do
  let(:listing) { create(:listing, :stay) }
  let(:booking) { create(:booking, :checkout, listing:, status: "awaiting_payment", expires_at: 20.minutes.from_now) }
  let(:payment) { create(:payment, :paymongo, user: booking.user, covered_booking_ids: [ booking.id ]) }
  let(:session_id) { payment.provider_ref }
  let(:livemode) { false }
  let(:body) do
    { data: { id: "evt_1", type: "event", attributes: { type: "checkout_session.payment.paid", livemode:,
                                                         data: { id: session_id, type: "checkout_session" } } } }
  end
  let(:timestamp) { Time.current.to_i }
  # rswag sends the body as body.to_json: sign exactly those bytes, test mode (te).
  let(:'Paymongo-Signature') do
    "t=#{timestamp},te=#{OpenSSL::HMAC.hexdigest('SHA256', 'whsk_test_spec', "#{timestamp}.#{body.to_json}")},li="
  end

  before do
    enable_paymongo
    allow(Paymongo).to receive(:checkout_session) { paymongo_session(payment.provider_ref, paid: true) }
  end

  path "/api/v1/webhooks/paymongo" do
    post "PayMongo reports a payment on a checkout" do
      tags "Webhooks"
      consumes "application/json"
      description "Called by PayMongo, not by the apps. Signed in `Paymongo-Signature` " \
        "(`t=<unix time>,te=<test signature>,li=<live signature>`, the HMAC-SHA256 of `<t>.<raw body>` keyed with " \
        "the endpoint's secret, at most 5 minutes off). Test mode only: a live signature or event is not accepted. " \
        "Only checkout_session.payment.paid is acted on, and the payment is read back from PayMongo, not trusted " \
        "from the body."
      parameter name: :'Paymongo-Signature', in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { type: :object, properties: { data: { type: :object } }, required: %w[data] }

      response "200", "a paid checkout: its bookings confirmed" do
        run_test! do
          expect(payment.reload).to have_attributes(status: "paid")
          expect(booking.reload).to have_attributes(status: "confirmed", payment:)
        end
      end

      response "200", "the same event delivered twice confirms once" do
        before { Payments::Sync.call(payment) }

        run_test! do
          expect(Paymongo).to have_received(:checkout_session).once
          expect(booking.reload.events.where(to_status: "confirmed").count).to eq(1)
        end
      end

      response "200", "a live event: ignored, payments are in test mode" do
        let(:livemode) { true }

        run_test! do
          expect(Paymongo).not_to have_received(:checkout_session)
          expect(booking.reload).to be_awaiting_payment
        end
      end

      response "200", "a checkout we don't know: ignored" do
        let(:session_id) { "cs_unknown" }

        run_test! { expect(Paymongo).not_to have_received(:checkout_session) }
      end

      response "401", "a bad signature" do
        schema "$ref" => "#/components/schemas/error"

        let(:'Paymongo-Signature') { "t=#{timestamp},te=0000,li=" }

        run_test! { expect(booking.reload).to be_awaiting_payment }
      end

      response "502", "PayMongo can't be asked: PayMongo retries the delivery" do
        schema "$ref" => "#/components/schemas/error"

        before { allow(Paymongo).to receive(:checkout_session).and_raise(Paymongo::Error, "PayMongo answered 500") }

        run_test! { expect(payment.reload).to be_pending }
      end
    end
  end
end
