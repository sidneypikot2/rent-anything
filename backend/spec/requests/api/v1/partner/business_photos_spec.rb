require "swagger_helper"

RSpec.describe "Partner business photos and logo", type: :request do
  let(:user) { create(:user, :partner) }
  let(:Authorization) { bearer_for(user) }
  let!(:business) { create(:business, partner: user) }
  let(:business_id) { business.id }
  let(:upload_body) do
    { filename: "shop.jpg", byte_size: 2_400_000, checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", content_type: "image/jpeg" }
  end

  def create_logo(uploaded: true)
    business.create_logo!(filename: "logo.png", content_type: "image/png", byte_size: 505,
      checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", uploaded_at: (Time.current if uploaded), sized_at: (Time.current if uploaded))
  end

  path "/api/v1/partner/businesses/{business_id}/photos" do
    parameter name: :business_id, in: :path, schema: { type: :integer }

    post "Add a cover photo to a business" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only (RAA-281). As a listing photo: `PUT` the file's bytes to `upload.url` with exactly " \
        "`upload.headers`, then confirm with `PATCH`. It goes after the others; the first leads the shop page. At most 8."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/photo_upload_body" }

      let(:body) { upload_body }

      response "201", "the new photo, still uploading, after the others" do
        schema "$ref" => "#/components/schemas/photo_upload"

        let!(:first) { create_photo(business) }

        run_test! do |response|
          photo = BusinessPhoto.find(response.parsed_body["id"])
          expect(photo).to have_attributes(business:, position: 2, filename: "shop.jpg", uploaded_at: nil)
          expect(response.parsed_body["upload"]["url"]).to include("/test/business_photos/#{photo.id}/image.jpg")
        end
      end

      response "422", "one too many" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { Business::MAX_COVER_PHOTOS.times { create_photo(business) } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "A business can have at most 8 cover photos" ])
        end
      end

      response "404", "another partner's business" do
        schema "$ref" => "#/components/schemas/error"

        let(:business_id) { create(:business).id }

        run_test! { expect(BusinessPhoto.count).to eq(0) }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { bearer_for(create(:user)) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/partner/businesses/{business_id}/photos/{id}" do
    parameter name: :business_id, in: :path, schema: { type: :integer }
    parameter name: :id, in: :path, schema: { type: :integer }

    patch "Confirm a business photo's upload, or move it" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only (RAA-281). `uploaded: true` once the file is in storage, and/or `position` to move it; " \
        "1 makes it lead the shop page."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/admin_photo_update_body" }

      let(:photos) { Array.new(2) { create_photo(business) } }
      let(:id) { photos.last.id }
      let(:body) { { position: 1 } }

      response "200", "moved first" do
        schema "$ref" => "#/components/schemas/partner_photo"

        run_test! { expect(business.photos.reload.map(&:id)).to eq(photos.reverse.map(&:id)) }
      end

      response "404", "another partner's business photo" do
        schema "$ref" => "#/components/schemas/error"

        let(:id) { create_photo(create(:business)).id }

        run_test!
      end
    end

    delete "Delete a business photo" do
      tags "Partner"
      description "Partner-only (RAA-281). The ones after it move up."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      let(:photos) { Array.new(2) { create_photo(business) } }
      let(:id) { photos.first.id }

      response "204", "deleted, the next one first" do
        run_test! { expect(business.photos.reload.map { [ _1.id, _1.position ] }).to eq([ [ photos.last.id, 1 ] ]) }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { bearer_for(create(:user)) }

        run_test! { expect(BusinessPhoto.count).to eq(2) }
      end
    end
  end

  path "/api/v1/partner/businesses/{business_id}/logo" do
    parameter name: :business_id, in: :path, schema: { type: :integer }

    post "Add a business's logo" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only (RAA-281). Replaces the logo before. Then `PUT` the file to `upload.url` and confirm with `PATCH`."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/photo_upload_body" }

      let(:body) { upload_body.merge(filename: "logo.png", content_type: "image/png") }

      response "201", "the new logo, still uploading, in place of the old one" do
        schema "$ref" => "#/components/schemas/photo_upload"

        let!(:old) { create_logo }

        run_test! do |response|
          logo = BusinessLogo.find(response.parsed_body["id"])
          expect(logo).to have_attributes(business:, filename: "logo.png", uploaded_at: nil)
          expect(BusinessLogo.exists?(old.id)).to be(false)
          expect(response.parsed_body["upload"]["url"]).to include("/test/business_logos/#{logo.id}/image.png")
        end
      end

      response "422", "not a photo we take" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { upload_body.merge(content_type: "application/pdf") }

        run_test! { expect(BusinessLogo.count).to eq(0) }
      end

      response "404", "another partner's business" do
        schema "$ref" => "#/components/schemas/error"

        let(:business_id) { create(:business).id }

        run_test!
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { bearer_for(create(:user)) }

        run_test!
      end
    end

    patch "Confirm a business logo's upload" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only (RAA-281). `uploaded: true` once the file is in storage."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { type: :object, properties: { uploaded: { type: :boolean } }, required: %w[uploaded] }

      let(:body) { { uploaded: true } }

      response "200", "uploaded, sizes on the way" do
        schema "$ref" => "#/components/schemas/partner_photo"

        before do
          create_logo(uploaded: false)
          stub_photo_in_storage
        end

        run_test! { |response| expect(response.parsed_body).to include("uploaded" => true, "ready" => false) }
      end

      response "404", "no logo yet" do
        schema "$ref" => "#/components/schemas/error"

        run_test!
      end
    end

    delete "Delete a business's logo" do
      tags "Partner"
      description "Partner-only (RAA-281)."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "204", "deleted" do
        before { create_logo }

        run_test! { expect(business.reload.logo).to be_nil }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
