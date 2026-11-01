require "swagger_helper"

RSpec.describe "Admin area banner photos (deprecated)", type: :request do
  let(:user) { create(:user, :admin) }
  let(:Authorization) { bearer_for(user) }
  let!(:area) { create(:area, slug: "bantayan-island", name: "Bantayan Island") }
  let(:area_slug) { "bantayan-island" }

  # RAA-164's one banner is now the first of the area's photos (RAA-210).
  def create_banner(uploaded: true)
    create_photo(area, uploaded:)
  end

  path "/api/v1/admin/areas/{area_slug}/banner_photo" do
    parameter name: :area_slug, in: :path, schema: { type: :string }

    post "Set a destination's banner photo" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      deprecated true
      description "Deprecated (RAA-210): use the area's photos. Replaces its first photo, if it has one; the upload " \
        "goes as a photo's."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/photo_upload_body" }

      let(:body) do
        { filename: "beach.jpg", byte_size: 2_400_000, checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", content_type: "image/jpeg" }
      end

      response "201", "the new banner, still uploading, replacing the first photo" do
        schema "$ref" => "#/components/schemas/photo_upload"

        let!(:old) { create_banner }
        let!(:other) { create_banner }

        run_test! do |response|
          photo = area.photos.first
          expect(photo).to have_attributes(id: response.parsed_body["id"], filename: "beach.jpg", uploaded_at: nil)
          expect(response.parsed_body["upload"]["url"]).to include("/test/area_photos/#{photo.id}/image.jpg")
          expect(area.photos.map { [ it.id, it.position ] }).to eq([ [ photo.id, 1 ], [ other.id, 2 ] ])
        end
      end

      response "422", "not a photo we take" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { filename: "menu.pdf", byte_size: "11", checksum: "nope", content_type: "application/pdf" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "Photo must be a JPEG, PNG or WebP image", "Size must be a whole number of bytes", "Checksum must be a base64 MD5"
          )
          expect(AreaPhoto.count).to eq(0)
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user, :partner) }

        run_test! { expect(AreaPhoto.count).to eq(0) }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end

    patch "Confirm a banner photo's upload" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      deprecated true
      description "Deprecated (RAA-210): confirms the first photo's upload."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/photo_update_body" }

      let(:body) { { uploaded: true } }

      response "200", "uploaded, sizes on the way" do
        schema "$ref" => "#/components/schemas/area_banner_photo"

        let!(:photo) { create_banner(uploaded: false) }

        before { stub_photo_in_storage }

        run_test! do |response|
          expect(response.parsed_body).to include("uploaded" => true, "ready" => false)
          expect(photo.reload.uploaded_at).to be_present
        end
      end

      response "422", "the file isn't there yet" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before do
          create_banner(uploaded: false)
          stub_photo_missing
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Photo must finish uploading first" ])
        end
      end

      response "404", "no banner" do
        schema "$ref" => "#/components/schemas/error"

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user, :partner) }

        before { create_banner(uploaded: false) }

        run_test!
      end
    end

    delete "Remove a destination's banner photo" do
      tags "Admin"
      deprecated true
      description "Deprecated (RAA-210): deletes the first photo."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "204", "removed" do
        let!(:photo) { create_banner }

        run_test! do
          expect(area.photos.reload).to be_empty
          expect(ListingPhotos::DeleteFilesJob).to have_been_enqueued.with(
            %w[image image_card image_large].map { "test/area_photos/#{photo.id}/#{it}.jpg" }
          )
        end
      end

      response "403", "a partner" do
        let(:user) { create(:user, :partner) }

        before { create_banner }

        run_test! { expect(area.photos.reload).to be_present }
      end
    end
  end
end
