require "swagger_helper"

RSpec.describe "Partner direct uploads", type: :request do
  path "/api/v1/partner/direct_uploads" do
    post "Start a photo upload" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only, after the ID check (RAA-106). Reserves a listing photo and returns where the browser " \
        "sends the file: a `PUT` of the file's bytes to `upload.url` with exactly `upload.headers`, straight to " \
        "storage (Cloudflare R2), not to this API. Then pass `signed_id` in a listing's `photos`. JPEG, PNG or " \
        "WebP, at most 10 MB; `checksum` is the file's MD5, base64-encoded. A photo no listing takes within " \
        "two days is deleted."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/direct_upload_body" }

      let(:user) { create(:user, :partner, :id_verified) }
      let(:Authorization) { bearer_for(user) }
      let(:body) do
        { filename: "beach.jpg", byte_size: 2_400_000, checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", content_type: "image/jpeg" }
      end

      response "201", "a reserved photo and where to put it" do
        schema "$ref" => "#/components/schemas/direct_upload"

        run_test! do |response|
          blob = ActiveStorage::Blob.find_signed!(response.parsed_body["signed_id"])
          expect(blob).to have_attributes(filename: "beach.jpg", byte_size: 2_400_000, content_type: "image/jpeg")
          expect(response.parsed_body["upload"]["url"]).to be_present
          # R2 also wants Content-MD5; the test disk service checks the checksum itself.
          expect(response.parsed_body["upload"]["headers"]).to include("Content-Type" => "image/jpeg")
        end
      end

      response "422", "not a photo we take" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { filename: "menu.pdf", byte_size: 11_000_000, checksum: "nope", content_type: "application/pdf" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "Photo must be a JPEG, PNG or WebP image", "Photo must be at most 10 MB", "Checksum must be a base64 MD5"
          )
          expect(ActiveStorage::Blob.count).to eq(0)
        end
      end

      response "422", "values of the wrong type" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { filename: 7, byte_size: "2400000", checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", content_type: "image/jpeg" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "File name is required", "Size must be a whole number of bytes"
          )
        end
      end

      response "403", "a partner who hasn't passed the ID check" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

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
