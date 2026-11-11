require "swagger_helper"

RSpec.describe "Email confirmation", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user, :unconfirmed, email: "ana@example.com") }

  path "/api/v1/email_confirmation" do
    post "Email the signed-in user a link to confirm their email" do
      tags "Auth"
      produces "application/json"
      description "RAA-214. Sends again the link sign-up sends: it opens /confirm-email?token=… on the web app and " \
        "works for 24 hours, until the email changes. Answers 202 and sends nothing when the email is confirmed " \
        "already. Limited per IP and per user."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:Authorization) { bearer_for(user) }

      response "202", "unconfirmed: a link is sent" do
        run_test! do
          expect(ActionMailer::MailDeliveryJob).to have_been_enqueued
            .with("AccountMailer", "email_confirmation", "deliver_now", a_hash_including(args: array_including(user)))
        end
      end

      response "202", "confirmed already: nothing is sent" do
        let(:user) { create(:user) }

        run_test! { expect(ActionMailer::MailDeliveryJob).not_to have_been_enqueued }
      end

      response "422", "a guest with no email yet" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:user) { User.create!(role: "guest") }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end

      response "429", "too many from one IP" do
        schema "$ref" => "#/components/schemas/error"
        before { exceed_auth_rate_limit(Api::V1::EmailConfirmationsController) }

        run_test!
      end
    end
  end

  path "/api/v1/email_confirmation/verify" do
    post "Confirm an email with the emailed link's token" do
      tags "Auth"
      consumes "application/json"
      description "RAA-214. No sign-in needed: the link may open on another device. A token works for 24 hours, " \
        "and only while the account's email is still the one it was sent to. Confirming again is harmless."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { token: { type: :string } }, required: %w[token]
      }

      let(:token) { user.generate_token_for(:email_confirmation) }
      let(:body) { { token: } }

      response "204", "confirmed" do
        run_test! { expect(user.reload.email_confirmed_at).to be_within(1.minute).of(Time.current) }
      end

      response "422", "an expired token" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:token) { travel_to(25.hours.ago) { user.generate_token_for(:email_confirmation) } }

        run_test! { expect(user.reload.email_confirmed_at).to be_nil }
      end

      response "422", "a token sent before the email changed" do
        schema "$ref" => "#/components/schemas/validation_errors"
        before do
          token
          user.update!(email: "other@example.com")
        end

        run_test! { expect(user.reload.email_confirmed_at).to be_nil }
      end

      response "422", "a token for something else" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:token) { user.generate_token_for(:password_reset) }

        run_test!
      end

      response "422", "no token" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { {} }

        run_test!
      end

      response "429", "too many from one IP" do
        schema "$ref" => "#/components/schemas/error"
        before { exceed_auth_rate_limit(Api::V1::EmailConfirmationsController) }

        run_test!
      end
    end
  end
end
