require "swagger_helper"

RSpec.describe "Sign-in codes", type: :request do
  let!(:user) { create(:user, :profile_complete, password: nil, email: "ana@example.com") }

  path "/api/v1/sign_in_codes" do
    post "Email a guest a sign-in code" do
      tags "Auth"
      consumes "application/json"
      description "RAA-175. For a guest who lost their trip link, forgot their PIN or locked the link. Answers 202 " \
        "whether or not the email has a guest account, and only a guest's email gets a code. A new code replaces " \
        "the last one. Limited per IP and per email."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { email: { type: :string } }, required: %w[email]
      }

      let(:body) { { email: " ANA@example.com" } }

      response "202", "a guest's email: a code is sent" do
        run_test! do
          expect(user.sign_in_codes.usable.count).to eq(1)
          expect(ActionMailer::MailDeliveryJob).to have_been_enqueued
            .with("GuestMailer", "sign_in_code", "deliver_now", a_hash_including(args: array_including(user)))
        end
      end

      response "202", "an email with no guest account: the same answer, nothing sent" do
        let(:body) { { email: "nobody@example.com" } }
        before { create(:user, :partner, email: "nobody@example.com") }

        run_test! do
          expect(SignInCode.count).to eq(0)
          expect(ActionMailer::MailDeliveryJob).not_to have_been_enqueued
        end
      end

      response "422", "no email" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { {} }

        run_test!
      end

      response "429", "too many from one IP" do
        schema "$ref" => "#/components/schemas/error"
        before { exceed_auth_rate_limit(Api::V1::SignInCodesController) }

        run_test!
      end
    end
  end

  path "/api/v1/sign_in_codes/verify" do
    post "Sign in with an emailed code" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "RAA-175. A code works once, for 10 minutes and 5 tries. Sent by a guest with no email yet (the " \
        "409 at checkout), their trips move into this account and that emailless guest is deleted. From this " \
        "session the guest can reset their trip link and PIN (POST /trip_access/rotate)."
      parameter name: :Authorization, in: :header, required: false, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { email: { type: :string }, code: { type: :string } },
        required: %w[email code]
      }

      let(:Authorization) { nil }
      let!(:code) { SignInCode.issue!(user) }
      let(:body) { { email: "ana@example.com", code: } }
      let(:wrong) { code == "000000" ? "111111" : "000000" }

      response "200", "signed in; the code is spent" do
        schema "$ref" => "#/components/schemas/auth_tokens"

        run_test! do |response|
          expect(response.parsed_body.dig("user", "id")).to eq(user.id)
          expect(user.sign_in_codes.usable.count).to eq(0)
        end
      end

      response "200", "from a guest with no email yet: their trips move into this account" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        let(:anonymous) { User.create!(role: "guest") }
        let!(:trip) { create(:trip, user: anonymous) }
        let(:Authorization) { bearer_for(anonymous) }

        run_test! do |response|
          expect(response.parsed_body.dig("user", "id")).to eq(user.id)
          expect(trip.reload.user).to eq(user)
          expect(User.exists?(anonymous.id)).to be(false)
        end
      end

      response "401", "a wrong code, counted" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { { email: "ana@example.com", code: wrong } }

        run_test! do
          expect(user.sign_in_codes.last.attempts).to eq(1)
        end
      end

      response "401", "the right code after its tries ran out" do
        schema "$ref" => "#/components/schemas/error"
        before { user.sign_in_codes.last.update!(attempts: SignInCode::MAX_ATTEMPTS) }

        run_test!
      end

      response "401", "an expired code" do
        schema "$ref" => "#/components/schemas/error"
        before { user.sign_in_codes.last.update!(expires_at: 1.second.ago) }

        run_test!
      end

      response "401", "a code already used" do
        schema "$ref" => "#/components/schemas/error"
        before { user.sign_in_codes.last.update!(consumed_at: 1.minute.ago) }

        run_test!
      end

      response "401", "a code replaced by a newer one" do
        schema "$ref" => "#/components/schemas/error"
        before { SignInCode.issue!(user) }

        run_test!
      end

      response "422", "a code sent as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { email: "ana@example.com", code: 123_456 } }

        run_test!
      end

      response "429", "too many from one IP" do
        schema "$ref" => "#/components/schemas/error"
        before { exceed_auth_rate_limit(Api::V1::SignInCodesController) }

        run_test!
      end
    end
  end
end
