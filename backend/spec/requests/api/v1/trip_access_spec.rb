require "swagger_helper"

RSpec.describe "Trip access", type: :request do
  let(:user) { create(:user, :profile_complete, password: nil, email: "ana@example.com") }
  let!(:link) { TripAccess.issue!(user) }

  path "/api/v1/trip_access/unlock" do
    post "Open a trip link with its PIN" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "RAA-175. Every open of the trip link asks for its PIN. The session lasts one open: its refresh " \
        "token stops working 12 hours after the unlock, refreshes included, and the web app keeps it only in " \
        "that tab. An unknown link and a wrong PIN get the same 401. Five wrong PINs in a row lock the link (423) " \
        "until the guest resets it after signing in with an emailed code (POST /sign_in_codes)."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          token: { type: :string, description: "From the trip link, /trips/open/<token>" },
          pin: { type: :string }
        },
        required: %w[token pin]
      }

      let(:body) { { token: link[:token], pin: link[:pin] } }

      response "200", "opened: a session that ends with this open" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        before { user.trip_access.update!(failed_attempts: 3) }

        run_test! do |response|
          expect(response.parsed_body.dig("user", "id")).to eq(user.id)
          expect(RefreshToken.find_by_token(response.parsed_body["refresh_token"])).to have_attributes(
            fixed_expiry: true, expires_at: be_within(1.minute).of(Auth::UnlockTripLink::SESSION_LIFETIME.from_now))
          expect(user.trip_access.reload.failed_attempts).to eq(0)
        end
      end

      response "401", "a wrong PIN, counted" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { { token: link[:token], pin: link[:pin] == "000000" ? "111111" : "000000" } }

        run_test! do |response|
          expect(response.parsed_body["error"]).to eq("That trip link or PIN is wrong")
          expect(user.trip_access.reload.failed_attempts).to eq(1)
        end
      end

      response "401", "an unknown link: the same answer" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { { token: "not-a-link", pin: link[:pin] } }

        run_test! do |response|
          expect(response.parsed_body["error"]).to eq("That trip link or PIN is wrong")
        end
      end

      response "423", "the fifth wrong PIN locks the link, and then the right one doesn't open it" do
        schema "$ref" => "#/components/schemas/error"
        let(:wrong) { link[:pin] == "000000" ? "111111" : "000000" }
        let(:body) { { token: link[:token], pin: wrong } }
        before { user.trip_access.update!(failed_attempts: TripAccess::MAX_ATTEMPTS - 1) }

        run_test! do
          expect(user.trip_access.reload).to be_locked
          post "/api/v1/trip_access/unlock", as: :json, params: { token: link[:token], pin: link[:pin] }
          expect(response).to have_http_status(:locked)
        end
      end

      response "422", "a PIN sent as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { token: link[:token], pin: 123_456 } }

        run_test!
      end

      response "429", "too many from one IP" do
        schema "$ref" => "#/components/schemas/error"
        before { exceed_auth_rate_limit(Api::V1::TripAccessController) }

        run_test!
      end
    end
  end

  path "/api/v1/trip_access/rotate" do
    post "Make a new trip link and PIN" do
      tags "Auth"
      produces "application/json"
      description "Guest-only (RAA-175). The old link and PIN stop working, a locked link is unlocked, and the new " \
        "pair is returned once. For a guest who has given their email (at their first checkout)."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:Authorization) { bearer_for(user) }

      response "200", "a new pair; the old one no longer opens" do
        schema "$ref" => "#/components/schemas/trip_link"
        before { user.trip_access.update!(locked_at: Time.current, failed_attempts: 5) }

        run_test! do |response|
          fresh = response.parsed_body
          expect(TripAccess.find_by_token(link[:token])).to be_nil
          expect(user.trip_access.reload).to have_attributes(locked_at: nil, failed_attempts: 0, rotated_at: be_present)
          post "/api/v1/trip_access/unlock", as: :json, params: { token: fresh["token"], pin: fresh["pin"] }
          expect(response).to have_http_status(:ok)
        end
      end

      response "422", "a guest with no email yet" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:Authorization) { bearer_for(User.create!(role: "guest")) }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { bearer_for(create(:user, :partner)) }

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
