require "swagger_helper"

RSpec.describe "Didit webhook", type: :request do
  let(:secret) { "test-webhook-secret" }
  let(:verification) { create(:partner_verification, status: "in_progress") }
  let(:body) { { webhook_type: "status.updated", session_id: verification.didit_session_id, status: "Declined" } }
  let(:'X-Timestamp') { Time.current.to_i.to_s }
  # rswag sends the body as body.to_json: sign exactly those bytes.
  let(:'X-Signature') { OpenSSL::HMAC.hexdigest("SHA256", secret, body.to_json) }

  before do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("DIDIT_WEBHOOK_SECRET").and_return(secret)
    allow(Didit).to receive(:decision).and_return("status" => "Declined")
  end

  path "/api/v1/webhooks/didit" do
    post "Didit reports a change to an ID check" do
      tags "Webhooks"
      consumes "application/json"
      description "Called by Didit, not by the apps. Signed with HMAC-SHA256 of the raw body " \
        "(`X-Signature`, keyed with the destination's secret) and timestamped (`X-Timestamp`, Unix seconds, " \
        "at most 5 minutes off). The status in the body is not trusted: the API reads it back from Didit."
      parameter name: :'X-Signature', in: :header, schema: { type: :string }
      parameter name: :'X-Timestamp', in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          webhook_type: { type: :string },
          session_id: { type: :string },
          status: { type: :string }
        },
        required: %w[session_id]
      }

      response "200", "a known check: its status read back from Didit" do
        run_test! do
          expect(Didit).to have_received(:decision).with(verification.didit_session_id)
          expect(verification.reload).to have_attributes(status: "declined", declined_count: 1)
          expect(verification.last_declined_at).to be_within(1.minute).of(Time.current)
        end
      end

      response "200", "the same decline delivered twice counts once" do
        before { verification.update!(status: "declined", declined_count: 1, last_declined_at: 1.minute.ago) }

        run_test! { expect(verification.reload.declined_count).to eq(1) }
      end

      response "200", "a check we don't know (an older session): ignored" do
        let(:body) { { webhook_type: "status.updated", session_id: "unknown", status: "Approved" } }

        run_test! { expect(Didit).not_to have_received(:decision) }
      end

      response "502", "Didit can't be asked for the status: Didit retries the delivery" do
        schema "$ref" => "#/components/schemas/error"

        before { allow(Didit).to receive(:decision).and_raise(Didit::Error, "Didit answered 500") }

        run_test! { expect(verification.reload.status).to eq("in_progress") }
      end

      response "503", "no webhook secret configured" do
        schema "$ref" => "#/components/schemas/error"
        let(:secret) { "" }
        let(:'X-Signature') { "anything" }

        run_test!
      end

      response "401", "a wrong signature" do
        schema "$ref" => "#/components/schemas/error"
        let(:'X-Signature') { OpenSSL::HMAC.hexdigest("SHA256", "another-secret", body.to_json) }

        run_test! { expect(verification.reload.status).to eq("in_progress") }
      end

      response "401", "a stale timestamp" do
        schema "$ref" => "#/components/schemas/error"
        let(:'X-Timestamp') { 6.minutes.ago.to_i.to_s }

        run_test! { expect(verification.reload.status).to eq("in_progress") }
      end

      response "401", "no signature" do
        schema "$ref" => "#/components/schemas/error"
        let(:'X-Signature') { nil }

        run_test!
      end
    end
  end
end
