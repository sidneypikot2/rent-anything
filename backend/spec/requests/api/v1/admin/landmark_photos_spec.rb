require "swagger_helper"

RSpec.describe "Admin place to see photos", type: :request do
  let(:user) { create(:user, :admin) }
  let(:Authorization) { bearer_for(user) }
  let!(:landmark) { create(:landmark, slug: "kota-beach", name: "Kota Beach") }
  let(:landmark_slug) { "kota-beach" }

  path "/api/v1/admin/landmarks/{landmark_slug}/photos" do
    parameter name: :landmark_slug, in: :path, schema: { type: :string }

    post "Add a photo to a place to see" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only (RAA-210), as a destination's: the first is its card's photo. At most 12."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/photo_upload_body" }

      let(:body) do
        { filename: "kota.webp", byte_size: 900_000, checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", content_type: "image/webp" }
      end

      response "201", "the new photo, still uploading, after the others" do
        schema "$ref" => "#/components/schemas/photo_upload"

        before { create_photo(landmark) }

        run_test! do |response|
          photo = LandmarkPhoto.find(response.parsed_body["id"])
          expect(photo).to have_attributes(landmark:, position: 2, uploaded_at: nil)
          expect(response.parsed_body["upload"]["url"]).to include("/test/landmark_photos/#{photo.id}/image.webp")
        end
      end

      response "422", "one too many" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { GalleryPhotos::MAX.times { create_photo(landmark) } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "A place to see can have at most 12 photos" ])
          expect(landmark.photos.count).to eq(12)
        end
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user, :partner) }

        run_test! { expect(LandmarkPhoto.count).to eq(0) }
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/admin/landmarks/{landmark_slug}/photos/{id}" do
    parameter name: :landmark_slug, in: :path, schema: { type: :string }
    parameter name: :id, in: :path, schema: { type: :integer }

    let!(:photos) { Array.new(2) { create_photo(landmark) } }
    let(:id) { photos.last.id }

    patch "Confirm a place to see photo's upload, or move it" do
      tags "Admin"
      consumes "application/json"
      produces "application/json"
      description "Admin-only (RAA-210), as a destination's: `position` 1 makes it the card's photo."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/admin_photo_update_body" }

      let(:body) { { uploaded: true, position: 1 } }

      response "200", "uploaded and moved first" do
        schema "$ref" => "#/components/schemas/admin_photo"

        let(:id) { create_photo(landmark, uploaded: false).id }

        before { stub_photo_in_storage }

        run_test! do |response|
          expect(response.parsed_body).to include("id" => id, "uploaded" => true)
          expect(landmark.photos.reload.map(&:id)).to eq([ id, *photos.map(&:id) ])
        end
      end

      response "404", "another place's photo" do
        schema "$ref" => "#/components/schemas/error"

        let(:id) { create_photo(create(:landmark)).id }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user, :partner) }

        run_test!
      end
    end

    delete "Delete a place to see photo" do
      tags "Admin"
      description "Admin-only (RAA-210). The ones after it move up; its files go from storage too."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "204", "deleted" do
        let(:id) { photos.first.id }

        run_test! do
          expect(landmark.photos.reload.map { [ it.id, it.position ] }).to eq([ [ photos.last.id, 1 ] ])
          expect(ListingPhotos::DeleteFilesJob).to have_been_enqueued.with(
            %w[image image_card image_large].map { "test/landmark_photos/#{id}/#{it}.jpg" }
          )
        end
      end

      response "403", "a partner" do
        let(:user) { create(:user, :partner) }

        run_test! { expect(landmark.photos.count).to eq(2) }
      end
    end
  end
end
