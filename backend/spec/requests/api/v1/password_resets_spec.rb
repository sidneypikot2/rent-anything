require "swagger_helper"

RSpec.describe "Password reset", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let!(:user) { create(:user, :unconfirmed, email: "ana@example.com", password: "password123") }

  path "/api/v1/password_reset" do
    post "Email a link to choose a new password" do
      tags "Auth"
      consumes "application/json"
      description "RAA-214. `role` is the page's, as at sign-in. Answers 202 whether or not the email has an " \
        "account of that role, and only an account with a password gets a link: it opens " \
        "/reset-password?token=… on the web app and works for 30 minutes, once. Limited per IP and per email."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { email: { type: :string }, role: { type: :string, enum: %w[guest partner] } },
        required: %w[email role]
      }

      let(:body) { { email: " ANA@example.com", role: "guest" } }

      response "202", "an account with a password: a link is sent" do
        run_test! do
          expect(ActionMailer::MailDeliveryJob).to have_been_enqueued
            .with("AccountMailer", "password_reset", "deliver_now", a_hash_including(args: array_including(user)))
        end
      end

      response "202", "an unknown email: the same answer, nothing sent" do
        let(:body) { { email: "nobody@example.com", role: "guest" } }

        run_test! { expect(ActionMailer::MailDeliveryJob).not_to have_been_enqueued }
      end

      response "202", "another role's email: nothing sent" do
        let(:body) { { email: "ana@example.com", role: "partner" } }

        run_test! { expect(ActionMailer::MailDeliveryJob).not_to have_been_enqueued }
      end

      response "202", "an account with no password (Google, or a guest without one): nothing sent" do
        before { user.update!(password: nil) }

        run_test! { expect(ActionMailer::MailDeliveryJob).not_to have_been_enqueued }
      end

      response "422", "no email" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { role: "guest" } }

        run_test!
      end

      response "422", "an admin" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { email: "ana@example.com", role: "admin" } }

        run_test!
      end

      response "429", "too many from one IP" do
        schema "$ref" => "#/components/schemas/error"
        before { exceed_auth_rate_limit(Api::V1::PasswordResetsController) }

        run_test!
      end
    end

    patch "Choose a new password with the emailed link's token" do
      tags "Auth"
      consumes "application/json"
      description "RAA-214. The token works for 30 minutes and only until the password changes, so once. Every " \
        "session of the account is signed out, and the email counts as confirmed: the link proved it. The " \
        "account then signs in with the new password."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { token: { type: :string }, password: { type: :string, minLength: 8 } },
        required: %w[token password]
      }

      let(:token) { user.generate_token_for(:password_reset) }
      let(:body) { { token:, password: "new-password-1" } }
      let!(:session) { Auth::IssueTokens.call(user) }

      response "204", "the password is changed and every session ends" do
        run_test! do
          user.reload
          expect(user.authenticate("new-password-1")).to eq(user)
          expect(user.refresh_tokens.active).to be_empty
          expect(user.email_confirmed_at).to be_present
        end
      end

      response "422", "a token used already" do
        schema "$ref" => "#/components/schemas/validation_errors"
        before do
          token
          user.update!(password: "changed-meanwhile")
        end

        run_test! do
          expect(user.reload.authenticate("changed-meanwhile")).to eq(user)
          expect(user.refresh_tokens.active).not_to be_empty
        end
      end

      response "422", "an expired token" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:token) { travel_to(31.minutes.ago) { user.generate_token_for(:password_reset) } }

        run_test! { expect(user.reload.authenticate("password123")).to eq(user) }
      end

      response "422", "a token for something else" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:token) { user.generate_token_for(:email_confirmation) }

        run_test!
      end

      response "422", "a password too short" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { token:, password: "short" } }

        run_test! do
          expect(user.reload.authenticate("password123")).to eq(user)
          expect(user.refresh_tokens.active).not_to be_empty
        end
      end

      response "422", "no password" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { token: } }

        run_test!
      end

      response "429", "too many from one IP" do
        schema "$ref" => "#/components/schemas/error"
        before { exceed_auth_rate_limit(Api::V1::PasswordResetsController) }

        run_test!
      end
    end
  end
end
