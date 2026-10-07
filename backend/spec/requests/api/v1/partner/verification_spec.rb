require "swagger_helper"

RSpec.describe "Partner ID verification", type: :request do
  let(:user) { create(:user, :partner) }
  let(:Authorization) { bearer_for(user) }

  path "/api/v1/partner/verification" do
    get "The partner's ID check" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Where the partner's Didit ID check stands. While it is pending, the API asks " \
        "Didit for news first, so the status is current when the partner comes back from Didit's page."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "200", "never started" do
        schema "$ref" => "#/components/schemas/partner_verification"

        run_test! do |response|
          expect(response.parsed_body).to eq(
            "status" => "not_started", "verified_at" => nil, "attempts_left" => 3, "retry_at" => nil
          )
        end
      end

      response "200", "pending: brought up to date from Didit" do
        schema "$ref" => "#/components/schemas/partner_verification"

        let!(:verification) { create(:partner_verification, user:, status: "in_progress") }

        before do
          allow(Didit).to receive(:decision).with(verification.didit_session_id).and_return("status" => "Approved")
        end

        run_test! do |response|
          expect(response.parsed_body["status"]).to eq("approved")
          expect(response.parsed_body["verified_at"]).to be_present
          expect(verification.reload).to be_approved
        end
      end

      response "200", "pending, and Didit can't be reached: the last known status" do
        schema "$ref" => "#/components/schemas/partner_verification"

        before do
          create(:partner_verification, user:, status: "in_review")
          allow(Didit).to receive(:decision).and_raise(Didit::Error, "Didit request failed")
        end

        run_test! { |response| expect(response.parsed_body["status"]).to eq("in_review") }
      end

      response "200", "declined three times: waiting out the cooldown" do
        schema "$ref" => "#/components/schemas/partner_verification"

        before do
          create(:partner_verification, user:, status: "declined", declined_count: 3, last_declined_at: 10.minutes.ago)
        end

        run_test! do |response|
          expect(response.parsed_body).to include("status" => "declined", "attempts_left" => 0)
          expect(Time.zone.parse(response.parsed_body["retry_at"])).to be_within(1.minute).of(50.minutes.from_now)
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end

    post "Start or resume the partner's ID check" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Returns the URL of Didit's hosted page, where the partner scans their ID and " \
        "takes a selfie; Didit sends them back to the web app's `/partner/verify` after. An unfinished check is " \
        "resumed rather than started again. After 3 declined checks the partner waits an hour from the last " \
        "one (429), then gets 3 more tries."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:session) do
        { "session_id" => "11111111-2222-3333-4444-555555555555", "status" => "Not Started",
          "url" => "https://verify.didit.me/session/abc" }
      end

      before { allow(Didit).to receive(:create_session).and_return(session) }

      response "201", "a new check" do
        schema "$ref" => "#/components/schemas/partner_verification_start"

        run_test! do |response|
          expect(response.parsed_body["url"]).to eq("https://verify.didit.me/session/abc")
          expect(response.parsed_body["verification"]).to include("status" => "not_started", "attempts_left" => 3)
          expect(Didit).to have_received(:create_session)
            .with(vendor_data: user.id.to_s, callback: "#{ENV.fetch('FRONTEND_ORIGIN', 'http://localhost:8100')}/partner/verify")
          expect(user.reload.partner_verification)
            .to have_attributes(didit_session_id: session["session_id"], status: "not_started")
        end
      end

      response "201", "an unfinished check, resumed as it was" do
        schema "$ref" => "#/components/schemas/partner_verification_start"

        before do
          create(:partner_verification, user:, didit_session_id: session["session_id"], status: "in_progress")
          allow(Didit).to receive(:decision).and_return("status" => "In Progress")
        end

        run_test! do |response|
          expect(response.parsed_body["verification"]["status"]).to eq("in_progress")
        end
      end

      response "429", "a third decline Didit hasn't reported yet: recorded before a new session replaces it" do
        schema type: :object,
          properties: { error: { type: :string }, retry_at: { type: :string, format: "date-time" } },
          required: %w[error retry_at]

        let!(:verification) do
          create(:partner_verification, user:, status: "in_progress", declined_count: 2,
            last_declined_at: 5.minutes.ago)
        end

        before do
          allow(Didit).to receive(:decision).with(verification.didit_session_id).and_return("status" => "Declined")
        end

        run_test! do
          expect(verification.reload).to have_attributes(status: "declined", declined_count: 3)
          expect(Didit).not_to have_received(:create_session)
        end
      end

      response "201", "a new try after a decline" do
        schema "$ref" => "#/components/schemas/partner_verification_start"

        before do
          create(:partner_verification, user:, status: "declined", declined_count: 2, last_declined_at: 1.minute.ago)
        end

        run_test! do |response|
          expect(response.parsed_body["verification"]).to include("status" => "not_started", "attempts_left" => 1)
          expect(user.reload.partner_verification.didit_session_id).to eq(session["session_id"])
        end
      end

      response "201", "three tries again once the cooldown has passed" do
        schema "$ref" => "#/components/schemas/partner_verification_start"

        before do
          create(:partner_verification, user:, status: "declined", declined_count: 3, last_declined_at: 61.minutes.ago)
        end

        run_test! do |response|
          expect(response.parsed_body["verification"]["attempts_left"]).to eq(3)
          expect(user.reload.partner_verification.declined_count).to eq(0)
        end
      end

      response "429", "declined three times within the hour" do
        schema type: :object,
          properties: { error: { type: :string }, retry_at: { type: :string, format: "date-time" } },
          required: %w[error retry_at]

        before do
          create(:partner_verification, user:, status: "declined", declined_count: 3, last_declined_at: 10.minutes.ago)
        end

        run_test! do |response|
          expect(response.parsed_body["error"]).to match(/declined 3 times/)
          expect(Time.zone.parse(response.parsed_body["retry_at"])).to be_within(1.minute).of(50.minutes.from_now)
          expect(Didit).not_to have_received(:create_session)
        end
      end

      response "422", "already verified" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { create(:partner_verification, :approved, user:) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Your ID is already verified")
          expect(Didit).not_to have_received(:create_session)
        end
      end

      response "422", "a check Didit is still reviewing" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before do
          create(:partner_verification, user:, status: "in_review")
          allow(Didit).to receive(:decision).and_return("status" => "In Review")
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Your ID check is being reviewed")
        end
      end

      response "503", "Didit isn't configured" do
        schema "$ref" => "#/components/schemas/error"

        before { allow(Didit).to receive(:create_session).and_raise(Didit::NotConfiguredError) }

        run_test! { expect(PartnerVerification.where.not(didit_session_id: nil)).to be_empty }
      end

      response "502", "Didit can't be reached" do
        schema "$ref" => "#/components/schemas/error"

        before { allow(Didit).to receive(:create_session).and_raise(Didit::Error, "Didit answered 500") }

        run_test! { expect(PartnerVerification.where.not(didit_session_id: nil)).to be_empty }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test! { expect(Didit).not_to have_received(:create_session) }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
