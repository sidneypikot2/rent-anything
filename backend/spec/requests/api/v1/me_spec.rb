require "swagger_helper"

RSpec.describe "Me", type: :request do
  path "/api/v1/me" do
    get "The signed-in user" do
      tags "Auth"
      produces "application/json"
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user) }
      let(:Authorization) { bearer_for(user) }

      response "200", "the user" do
        schema "$ref" => "#/components/schemas/user"

        run_test! do |response|
          expect(response.parsed_body).to include("id" => user.id, "role" => "guest")
        end
      end

      response "401", "no token" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end

      response "401", "an expired token" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { "Bearer #{JsonWebToken.encode(sub: user.id.to_s, expires_in: -1.minute)}" }

        run_test!
      end
    end
  end

  path "/api/v1/me" do
    patch "Edit the signed-in user's profile" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "Only `name` and `phone`; keys left out are unchanged. A blank or null `phone` clears it."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          name: { type: :string },
          phone: { type: :string, nullable: true }
        }
      }

      let(:user) { create(:user, name: "Ana", phone: "+639171234567") }
      let(:Authorization) { bearer_for(user) }
      let(:body) { { name: "Ana Reyes", phone: "+639181112222" } }

      response "200", "profile updated" do
        schema "$ref" => "#/components/schemas/user"

        run_test! do |response|
          expect(response.parsed_body).to include("name" => "Ana Reyes", "phone" => "+639181112222")
          expect(user.reload.name).to eq("Ana Reyes")
        end
      end

      response "200", "keys left out are unchanged; email and role are ignored" do
        schema "$ref" => "#/components/schemas/user"
        let(:body) { { name: "Ana Reyes", email: "other@example.com", role: "admin" } }

        run_test! do
          expect(user.reload).to have_attributes(name: "Ana Reyes", phone: "+639171234567", role: "guest")
          expect(user.email).not_to eq("other@example.com")
        end
      end

      response "200", "a null phone clears it" do
        schema "$ref" => "#/components/schemas/user"
        let(:body) { { phone: nil } }

        run_test! do
          expect(user.reload.phone).to be_nil
        end
      end

      response "200", "a blank phone clears it" do
        schema "$ref" => "#/components/schemas/user"
        let(:body) { { phone: "  " } }

        run_test! do
          expect(user.reload.phone).to be_nil
        end
      end

      response "422", "blank name" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { name: " " } }

        run_test! do
          expect(user.reload.name).to eq("Ana")
        end
      end

      response "422", "a complete profile can't clear its phone" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:user) { create(:user, :profile_complete) }
        let(:body) { { phone: nil } }

        run_test! do
          expect(user.reload.phone).to eq("+639171234567")
        end
      end

      response "422", "name given as null" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { name: nil } }

        run_test!
      end

      response "422", "phone that isn't a phone number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { phone: "abc" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Phone must be a phone number")
          expect(user.reload.phone).to eq("+639171234567")
        end
      end

      response "422", "phone given as a number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { phone: 639171234567 } }

        run_test! do
          expect(user.reload.phone).to eq("+639171234567")
        end
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end


  path "/api/v1/me" do
    delete "Delete the signed-in guest's account" do
      tags "Auth"
      produces "application/json"
      description "Guests only: deletes the account, its trips, sign-ins and sessions at once, and emails a " \
        "confirmation. Partners' records of past bookings stay. 409 while a booking is still open; 403 for " \
        "partners and admins, whose accounts the team closes on request."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :profile_complete) }
      let(:Authorization) { bearer_for(user) }

      response "204", "account deleted" do
        run_test! do
          expect(User.exists?(user.id)).to be(false)
        end
      end

      response "409", "a booking is still open" do
        schema "$ref" => "#/components/schemas/error"
        before { create(:booking, :checkout, user:, status: "requested") }

        run_test! do |response|
          expect(response.parsed_body["error"]).to match(/1 open booking/)
          expect(User.exists?(user.id)).to be(true)
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

        run_test! do
          expect(User.exists?(user.id)).to be(true)
        end
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end
  path "/api/v1/partner/me" do
    get "The signed-in partner" do
      tags "Auth"
      produces "application/json"
      description "Partner-only, like everything under /api/v1/partner."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:user) { create(:user, :partner) }
      let(:Authorization) { bearer_for(user) }

      response "200", "the partner" do
        schema "$ref" => "#/components/schemas/user"

        run_test!
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
  end
end
