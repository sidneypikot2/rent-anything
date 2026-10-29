require "swagger_helper"

RSpec.describe "Registrations", type: :request do
  path "/api/v1/registrations" do
    post "Sign up with email and password" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "`role` is the entry point: `guest` from /login, `partner` from /partner/login. " \
        "Admin accounts are never self-made. `name` and `phone` are optional; the account starts with " \
        "`registration_complete: false` until PUT /api/v1/me/complete_profile. `terms_accepted` must be true: " \
        "the account records when it agreed to the Terms and Privacy policy, and which version."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          email: { type: :string },
          name: { type: :string },
          phone: { type: :string },
          password: { type: :string, minLength: 8 },
          role: { type: :string, enum: %w[guest partner] },
          terms_accepted: { type: :boolean, description: "Agreed to the Terms and Privacy policy (and, for a partner, the Partner terms)" }
        },
        required: %w[email password role terms_accepted]
      }

      let(:body) do
        { email: "Ana@Example.com", name: "Ana Reyes", phone: "+639171234567", password: "password123", role: "guest", terms_accepted: true }
      end

      parameter name: :Authorization, in: :header, required: false, schema: { type: :string },
        description: "A guest with no account yet (RAA-175): their trips move into the account signed in to"

      response "201", "a partner can sign up with a guest's email" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        let(:body) { super().merge(role: "partner") }
        let!(:guest) { create(:user, email: "ana@example.com") }

        run_test! do |response|
          expect(response.parsed_body.dig("user", "id")).not_to eq(guest.id)
          expect(User.where(email: "ana@example.com").pluck(:role)).to contain_exactly("guest", "partner")
        end
      end

      response "201", "account created and signed in, with the terms it agreed to" do
        schema "$ref" => "#/components/schemas/auth_tokens"

        run_test! do |response|
          expect(User.last).to have_attributes(terms_version: User::TERMS_VERSION, terms_accepted_at: be_within(1.minute).of(Time.current))
          json = response.parsed_body
          expect(json["user"]).to include("email" => "ana@example.com", "role" => "guest")
          expect(User.find_by(email: "ana@example.com")).to be_present
        end
      end

      response "201", "a guest with no account yet signs up: their trips move into the new account" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        let(:body) { { email: "ana@example.com", password: "password123", role: "guest", terms_accepted: true } }
        let(:anonymous) { User.create!(role: "guest") }
        let!(:trip) { create(:trip, user: anonymous) }
        let(:Authorization) { bearer_for(anonymous) }

        run_test! do |response|
          expect(trip.reload.user_id).to eq(response.parsed_body.dig("user", "id"))
          expect(User.exists?(anonymous.id)).to be(false)
        end
      end

      response "201", "email and password alone; the profile is completed later" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        let(:body) { { email: "ana@example.com", password: "password123", role: "guest", terms_accepted: true } }

        run_test! do |response|
          expect(response.parsed_body["user"]).to include("name" => nil, "phone" => nil, "registration_complete" => false)
        end
      end

      response "422", "the terms not agreed to" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().except(:terms_accepted) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(a_string_matching(/Terms/))
          expect(User.count).to eq(0)
        end
      end

      response "422", "the terms given as a string" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(terms_accepted: "true") }

        run_test!
      end

      response "422", "name given as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(name: 42) }

        run_test! { expect(User.count).to eq(0) }
      end

      response "201", "a sign-up from /partner makes a partner" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        let(:body) { super().merge(role: "partner") }

        run_test! do |response|
          expect(response.parsed_body.dig("user", "role")).to eq("partner")
        end
      end

      response "422", "admin can't be self-made" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(role: "admin") }

        run_test! { expect(User.count).to eq(0) }
      end

      response "422", "role missing" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().except(:role) }

        run_test!
      end

      response "422", "password missing" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().except(:password) }

        run_test!
      end

      response "422", "password given as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(password: 12_345_678) }

        run_test! { expect(User.count).to eq(0) }
      end

      response "422", "phone that isn't a phone number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(phone: "abc") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Phone must be a phone number")
          expect(User.count).to eq(0)
        end
      end

      response "422", "phone given as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(phone: 639_171_234_567) }

        run_test! { expect(User.count).to eq(0) }
      end

      response "422", "password too short" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(password: "short") }

        run_test!
      end

      response "422", "email given as an object" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { super().merge(email: { address: "ana@example.com" }) }

        run_test! { expect(User.count).to eq(0) }
      end

      response "422", "email already taken by the same role, in any case" do
        schema "$ref" => "#/components/schemas/validation_errors"
        before { create(:user, email: "ana@example.com") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Email has already been taken")
        end
      end

      response "429", "too many attempts from one IP" do
        schema "$ref" => "#/components/schemas/error"
        before { exceed_auth_rate_limit(Api::V1::RegistrationsController) }

        run_test!
      end
    end
  end
end
