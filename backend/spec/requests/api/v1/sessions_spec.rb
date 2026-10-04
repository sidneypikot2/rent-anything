require "swagger_helper"

RSpec.describe "Sessions", type: :request do
  let!(:user) { create(:user, email: "maria@example.com", password: "correct horse") }

  path "/api/v1/sessions" do
    post "Sign in with email and password" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { email: { type: :string }, password: { type: :string } },
        required: %w[email password]
      }

      let(:body) { { email: "Maria@Example.com", password: "correct horse" } }

      response "200", "signed in" do
        schema "$ref" => "#/components/schemas/session"

        run_test! do
          json = response.parsed_body
          expect(json["user"]["id"]).to eq(user.id)
          expect(JsonWebToken.decode(json["access_token"])[:sub]).to eq(user.id)
          expect(user.refresh_tokens.active.count).to eq(1)
        end
      end

      response "401", "wrong email or password" do
        schema "$ref" => "#/components/schemas/error"

        context "with the wrong password" do
          let(:body) { { email: "maria@example.com", password: "wrong horse" } }

          run_test! do
            expect(response.parsed_body["error"]).to eq("Invalid email or password")
          end
        end

        context "with an unknown email" do
          let(:body) { { email: "nobody@example.com", password: "correct horse" } }

          run_test! do
            expect(response.parsed_body["error"]).to eq("Invalid email or password")
          end
        end
      end

      response "422", "email or password missing or not a string" do
        schema "$ref" => "#/components/schemas/validation_errors"

        context "when the password is missing" do
          let(:body) { { email: "maria@example.com" } }

          run_test! do
            expect(response.parsed_body["errors"]).to include("Password can't be blank")
          end
        end

        context "when the email is a hash" do
          let(:body) { { email: { "$ne" => "" }, password: "correct horse" } }

          run_test! do
            expect(response.parsed_body["errors"]).to include("Email must be a string")
          end
        end
      end
    end

    delete "Sign out: revoke a refresh token" do
      tags "Auth"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { refresh_token: { type: :string } },
        required: %w[refresh_token]
      }

      let(:raw) { "raw-refresh-token" }
      let!(:refresh_token) { create(:refresh_token, user: user, token: raw) }
      let(:body) { { refresh_token: raw } }

      response "204", "signed out; an unknown or already revoked token is ignored" do
        context "with a valid token" do
          run_test! do
            expect(refresh_token.reload.revoked_at).to be_present
          end
        end

        context "with an unknown token" do
          let(:body) { { refresh_token: "not-a-token" } }

          run_test! do
            expect(refresh_token.reload.revoked_at).to be_nil
          end
        end
      end

      response "422", "the refresh token is missing or not a string" do
        schema "$ref" => "#/components/schemas/validation_errors"

        context "when it is missing" do
          let(:body) { {} }

          run_test! do
            expect(response.parsed_body["errors"]).to include("Refresh token can't be blank")
          end
        end

        context "when it is a hash" do
          let(:body) { { refresh_token: { "$ne" => "" } } }

          run_test! do
            expect(response.parsed_body["errors"]).to include("Refresh token must be a string")
          end
        end
      end
    end
  end

  path "/api/v1/sessions/refresh" do
    post "Swap a refresh token for a new access and refresh token" do
      tags "Auth"
      description "The presented refresh token is rotated out. Presenting it again within 10 seconds " \
        "(two tabs refreshing at once) still works; after that it counts as a replay and signs the " \
        "user out everywhere. A token revoked by sign-out is just invalid."
      consumes "application/json"
      produces "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { refresh_token: { type: :string } },
        required: %w[refresh_token]
      }

      let(:raw) { "raw-refresh-token" }
      let!(:refresh_token) { create(:refresh_token, user: user, token: raw) }
      let(:body) { { refresh_token: raw } }

      response "200", "a new pair; the old refresh token is rotated out" do
        schema "$ref" => "#/components/schemas/session"

        context "with an active token" do
          run_test! do
            json = response.parsed_body
            expect(json["refresh_token"]).not_to eq(raw)
            expect(refresh_token.reload.rotated_at).to be_present
            expect(user.refresh_tokens.active.count).to eq(1)
            expect(JsonWebToken.decode(json["access_token"])[:sub]).to eq(user.id)
          end
        end

        context "with a token rotated moments ago (two tabs refreshing at once)" do
          let!(:refresh_token) do
            create(:refresh_token, user: user, token: raw, revoked_at: 2.seconds.ago, rotated_at: 2.seconds.ago)
          end
          let!(:other_session) { create(:refresh_token, user: user) }

          run_test! do
            expect(other_session.reload.revoked_at).to be_nil
          end
        end
      end

      response "422", "the refresh token is missing or not a string" do
        schema "$ref" => "#/components/schemas/validation_errors"

        context "when it is missing" do
          let(:body) { {} }

          run_test!
        end

        context "when it is an array" do
          let(:body) { { refresh_token: [ raw ] } }

          run_test! do
            expect(response.parsed_body["errors"]).to include("Refresh token must be a string")
          end
        end
      end

      response "401", "the refresh token is not valid" do
        schema "$ref" => "#/components/schemas/error"

        context "when it is unknown" do
          let(:body) { { refresh_token: "not-a-token" } }

          run_test!
        end

        context "when it has expired" do
          let!(:refresh_token) { create(:refresh_token, user: user, token: raw, expires_at: 1.minute.ago) }

          run_test!
        end

        context "when it was signed out: other sessions are left alone" do
          let!(:refresh_token) { create(:refresh_token, user: user, token: raw, revoked_at: 1.minute.ago) }
          let!(:other_session) { create(:refresh_token, user: user) }

          run_test! do
            expect(other_session.reload.revoked_at).to be_nil
          end
        end

        context "when it was rotated a while ago: every session of that user ends" do
          let!(:refresh_token) do
            create(:refresh_token, user: user, token: raw, revoked_at: 1.minute.ago, rotated_at: 1.minute.ago)
          end
          let!(:other_session) { create(:refresh_token, user: user) }
          let!(:someone_else) { create(:refresh_token) }

          run_test! do
            expect(other_session.reload.revoked_at).to be_present
            expect(someone_else.reload.revoked_at).to be_nil
          end
        end
      end
    end
  end
end
