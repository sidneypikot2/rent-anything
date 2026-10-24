require "swagger_helper"

RSpec.describe "Admin landmarks", type: :request do
  let(:user) { create(:user, :admin) }
  let(:Authorization) { bearer_for(user) }
  let!(:landmark) { create(:landmark, :draft, slug: "pescador", name: "Pescador Island") }

  path "/api/v1/admin/landmarks/{id}" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :id, in: :path, schema: { type: :integer }

    patch "Publish or unpublish a landmark" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only (RAA-168). Puts a landmark a seeding run found live, or takes one back to draft."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { status: { type: :string, enum: Landmark::STATUSES } }, required: %w[status]
      }

      let(:id) { landmark.id }

      response "200", "the landmark with its new status" do
        schema "$ref" => "#/components/schemas/admin_landmark"
        let(:body) { { status: "published" } }

        run_test! do |response|
          expect(response.parsed_body).to include("slug" => "pescador", "status" => "published")
          expect(landmark.reload).to be_published
        end
      end

      response "422", "a status that isn't one" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { status: "hidden" } }

        run_test! do
          expect(landmark.reload).to be_draft
        end
      end

      response "422", "no status" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { {} }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }
        let(:body) { { status: "published" } }

        run_test! do
          expect(landmark.reload).to be_draft
        end
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }
        let(:body) { { status: "published" } }

        run_test!
      end
    end
  end
end
