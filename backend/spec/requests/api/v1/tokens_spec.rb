require "swagger_helper"

RSpec.describe "Tokens", type: :request do
  path "/api/v1/tokens/refresh" do
    post "Trade a refresh token for new tokens" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "Each refresh token works once. Reusing one revokes every session of that user."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { refresh_token: { type: :string } },
        required: %w[refresh_token]
      }

      let(:user) { create(:user) }
      let(:refresh_token) { Auth::IssueTokens.call(user)[:refresh_token] }
      let(:body) { { refresh_token: refresh_token } }

      response "200", "new tokens; the old refresh token is spent" do
        schema "$ref" => "#/components/schemas/auth_tokens"

        run_test! do |response|
          expect(response.parsed_body["refresh_token"]).not_to eq(refresh_token)
          expect(RefreshToken.find_by_token(refresh_token)).not_to be_active
        end
      end

      response "200", "a trip link's session keeps its end: refreshing doesn't make it last longer" do
        schema "$ref" => "#/components/schemas/auth_tokens"
        let(:ends_at) { 3.hours.from_now }
        let(:refresh_token) { Auth::IssueTokens.call(user, session_ends_at: ends_at)[:refresh_token] }

        run_test! do |response|
          expect(RefreshToken.find_by_token(response.parsed_body["refresh_token"]))
            .to have_attributes(fixed_expiry: true, expires_at: be_within(1.second).of(ends_at))
        end
      end

      response "401", "a spent token is refused and revokes the user's sessions" do
        schema "$ref" => "#/components/schemas/error"

        let!(:other_session) { Auth::IssueTokens.call(user)[:refresh_token] }
        before { RefreshToken.find_by_token(refresh_token).update!(revoked_at: 2.minutes.ago) }

        run_test! do
          expect(RefreshToken.find_by_token(other_session)).not_to be_active
        end
      end

      response "401", "a token spent seconds ago (two tabs refreshing at once) leaves other sessions alone" do
        schema "$ref" => "#/components/schemas/error"

        let!(:other_session) { Auth::IssueTokens.call(user)[:refresh_token] }
        before { RefreshToken.find_by_token(refresh_token).revoke! }

        run_test! do
          expect(RefreshToken.find_by_token(other_session)).to be_active
        end
      end

      response "401", "an expired token" do
        schema "$ref" => "#/components/schemas/error"
        before { RefreshToken.find_by_token(refresh_token).update!(expires_at: 1.minute.ago) }

        run_test!
      end

      response "401", "an unknown token" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { { refresh_token: "not-a-token" } }

        run_test!
      end

      response "422", "token given as an array" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { refresh_token: [ "a" ] } }

        run_test!
      end
    end
  end
end
