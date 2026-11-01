require "swagger_helper"

RSpec.describe "Admin destination photos", type: :request do
  let(:user) { create(:user, :admin) }
  let(:Authorization) { bearer_for(user) }
  let!(:area) { create(:area, slug: "bantayan-island", name: "Bantayan Island") }
  let(:area_slug) { "bantayan-island" }

  path "/api/v1/admin/areas/{area_slug}/photos" do
    parameter name: :area_slug, in: :path, schema: { type: :string }

    post "Add a photo to a destination" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only (RAA-210). As a listing photo: `PUT` the file's bytes to `upload.url` with exactly " \
        "`upload.headers`, then confirm with `PATCH`. It goes after the others; the first is the banner. At most 12."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/photo_upload_body" }

      let(:body) do
        { filename: "beach.jpg", byte_size: 2_400_000, checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", content_type: "image/jpeg" }
      end

      response "201", "the new photo, still uploading, after the others" do
        schema "$ref" => "#/components/schemas/photo_upload"

        let!(:first) { create_photo(area) }

        run_test! do |response|
          photo = AreaPhoto.find(response.parsed_body["id"])
          expect(photo).to have_attributes(area:, position: 2, filename: "beach.jpg", uploaded_at: nil)
          expect(response.parsed_body["upload"]["url"]).to include("/test/area_photos/#{photo.id}/image.jpg")
          expect(first.reload.position).to eq(1)
        end
      end

      response "422", "not a photo we take, or one too many" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { filename: "menu.pdf", byte_size: "11", checksum: "nope", content_type: "application/pdf" } }

        run_test! do
          expect(response.parsed_body["errors"]).to contain_exactly(
            "Photo must be a JPEG, PNG or WebP image", "Size must be a whole number of bytes", "Checksum must be a base64 MD5"
          )
          expect(AreaPhoto.count).to eq(0)

          GalleryPhotos::MAX.times { create_photo(area) }
          post "/api/v1/admin/areas/#{area_slug}/photos", headers: { Authorization: bearer_for(user) }, as: :json,
            params: { filename: "beach.jpg", byte_size: 505, checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", content_type: "image/jpeg" }
          expect(response).to have_http_status(:unprocessable_content)
          expect(response.parsed_body["errors"]).to eq([ "A destination can have at most 12 photos" ])
        end
      end

      response "404", "no such destination" do
        schema "$ref" => "#/components/schemas/error"

        let(:area_slug) { "nowhere" }

        run_test!
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
  end

  path "/api/v1/admin/areas/{area_slug}/photos/{id}" do
    parameter name: :area_slug, in: :path, schema: { type: :string }
    parameter name: :id, in: :path, schema: { type: :integer }

    let!(:photos) { Array.new(3) { create_photo(area) } }
    let(:id) { photos.last.id }

    patch "Confirm a destination photo's upload, or move it" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only (RAA-210). `uploaded` once its file is in storage; its sizes follow a few seconds later " \
        "(`ready`). `position` moves it, the others shifting: 1 makes it the banner."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/admin_photo_update_body" }

      let(:body) { { uploaded: true } }

      response "200", "uploaded, sizes on the way" do
        schema "$ref" => "#/components/schemas/admin_photo"

        let(:id) { create_photo(area, uploaded: false).id }

        before { stub_photo_in_storage }

        run_test! do |response|
          expect(response.parsed_body).to include("id" => id, "uploaded" => true, "ready" => false)
          expect(AreaPhoto.find(id).uploaded_at).to be_present
        end
      end

      response "200", "moved first, the banner now" do
        schema "$ref" => "#/components/schemas/admin_photo"

        let(:body) { { position: 1 } }

        run_test! do
          expect(area.photos.reload.map(&:id)).to eq([ photos[2], photos[0], photos[1] ].map(&:id))
          expect(area.photos.map(&:position)).to eq([ 1, 2, 3 ])

          patch "/api/v1/admin/areas/#{area_slug}/photos/#{id}", headers: { Authorization: bearer_for(user) }, as: :json, params: { position: 3 }
          expect(area.photos.reload.map(&:id)).to eq(photos.map(&:id))
        end
      end

      response "422", "the file isn't there yet, or a position past the end" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:id) { create_photo(area, uploaded: false).id }

        before { stub_photo_missing }

        run_test! do
          expect(response.parsed_body["errors"]).to eq([ "Photo must finish uploading first" ])

          [ { position: 5 }, { position: "1" }, {} ].each do |params|
            patch "/api/v1/admin/areas/#{area_slug}/photos/#{photos.first.id}", headers: { Authorization: bearer_for(user) }, as: :json, params: params
            expect(response).to have_http_status(:unprocessable_content)
          end
          expect(area.photos.reload.map(&:id)).to eq(photos.map(&:id) + [ id ])
        end
      end

      response "404", "another destination's photo" do
        schema "$ref" => "#/components/schemas/error"

        let(:id) { create_photo(create(:area)).id }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user, :partner) }
        let(:body) { { position: 1 } }

        run_test! { expect(area.photos.reload.map(&:id)).to eq(photos.map(&:id)) }
      end
    end

    delete "Delete a destination photo" do
      tags "Admin"
      description "Admin-only (RAA-210). The ones after it move up; its files go from storage too."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "204", "deleted, the next one the banner" do
        let(:id) { photos.first.id }

        run_test! do
          expect(area.photos.reload.map { [ it.id, it.position ] }).to eq([ [ photos[1].id, 1 ], [ photos[2].id, 2 ] ])
          expect(ListingPhotos::DeleteFilesJob).to have_been_enqueued.with(
            %w[image image_card image_large].map { "test/area_photos/#{id}/#{it}.jpg" }
          )
        end
      end

      response "403", "a partner" do
        let(:user) { create(:user, :partner) }

        run_test! { expect(area.photos.count).to eq(3) }
      end
    end
  end
end
