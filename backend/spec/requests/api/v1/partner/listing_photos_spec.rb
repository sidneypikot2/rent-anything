require "swagger_helper"

RSpec.describe "Partner listing photos", type: :request do
  let(:user) { create(:user, :partner, :id_verified) }
  let(:Authorization) { bearer_for(user) }
  let(:listing) { create(:listing, partner: user) }
  let(:listing_id) { listing.id }

  path "/api/v1/partner/listings/{listing_id}/photos" do
    post "Add a photo to a listing" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only, after the ID check (RAA-106). Adds a photo after the listing's others and returns " \
        "where the browser sends the file: a `PUT` of the file's bytes to `upload.url` with exactly " \
        "`upload.headers`, straight to storage (Cloudflare R2), not to this API. Then confirm it with " \
        "`PATCH .../photos/{id}`; guests don't see it until then, and one not confirmed within two days is " \
        "deleted. JPEG, PNG or WebP, at most 10 MB, 12 per listing (5 per tour); `checksum` is the file's MD5, base64-encoded."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :listing_id, in: :path, schema: { type: :integer }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/photo_upload_body" }

      let(:body) do
        { filename: "beach.jpg", byte_size: 2_400_000, checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", content_type: "image/jpeg" }
      end

      response "201", "a photo still uploading, and where its file goes" do
        schema "$ref" => "#/components/schemas/photo_upload"

        before { create_photo(listing, position: 3) }

        run_test! do |response|
          photo = listing.photos.find(response.parsed_body["id"])
          expect(photo).to have_attributes(position: 4, filename: "beach.jpg", byte_size: 2_400_000, uploaded_at: nil)
          upload = response.parsed_body["upload"]
          expect(upload["url"]).to include("/test/listing_photos/#{photo.id}/image.jpg")
          expect(upload["headers"]).to eq("Content-Type" => "image/jpeg", "Content-MD5" => "1B2M2Y8AsgTpgAmY7PhCfg==")
        end
      end

      response "422", "not a photo we take" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { filename: "menu.pdf", byte_size: 11_000_000, checksum: "nope", content_type: "application/pdf" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly(
            "Photo must be a JPEG, PNG or WebP image", "Photo must be at most 10 MB", "Checksum must be a base64 MD5"
          )
          expect(ListingPhoto.count).to eq(0)
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

      response "422", "a listing that already has 12" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { 12.times { create_photo(listing, uploaded: false) } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "A listing can have at most 12 photos" ])
          expect(listing.photos.count).to eq(12)
        end
      end

      response "422", "a tour that already has 5 (RAA-110)" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:listing) { create(:listing, :tour, partner: user) }

        before { 5.times { create_photo(listing, uploaded: false) } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "A tour can have at most 5 photos" ])
          expect(listing.photos.count).to eq(5)
        end
      end

      response "404", "another partner's listing" do
        schema "$ref" => "#/components/schemas/error"
        let(:listing) { create(:listing) }

        run_test! { expect(ListingPhoto.count).to eq(0) }
      end

      response "403", "a partner who hasn't passed the ID check" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

        run_test! { expect(ListingPhoto.count).to eq(0) }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }
        let(:listing) { create(:listing) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/partner/listings/{listing_id}/photos/{id}" do
    parameter name: :Authorization, in: :header, schema: { type: :string }
    parameter name: :listing_id, in: :path, schema: { type: :integer }
    parameter name: :id, in: :path, schema: { type: :integer }

    let(:photo) { create_photo(listing, uploaded: false) }
    let(:id) { photo.id }

    patch "Confirm a photo's upload" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only (RAA-106). Once the browser's `PUT` has finished: checks the file is in storage, " \
        "then guests see the photo and its card and large sizes are made (until then both URLs are the " \
        "original's). Sending it again is harmless."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/photo_update_body" }

      let(:body) { { uploaded: true } }

      response "200", "uploaded, and its sizes on the way once, however often it is sent" do
        schema "$ref" => "#/components/schemas/partner_photo"

        before { stub_photo_in_storage }

        run_test! do |confirmed|
          expect(confirmed.parsed_body).to include("id" => photo.id, "uploaded" => true)
          expect(photo.reload.uploaded_at).to be_present
          expect(ListingPhotos::ResizeJob).to have_been_enqueued.with(photo)

          expect do
            patch "/api/v1/partner/listings/#{listing_id}/photos/#{id}", params: body, as: :json,
              headers: { "Authorization" => Authorization() }
          end.not_to have_enqueued_job(ListingPhotos::ResizeJob)
          expect(response).to have_http_status(:ok)
        end
      end

      response "422", "a file that hasn't reached storage yet" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { stub_photo_missing }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Photo must finish uploading first" ])
          expect(photo.reload.uploaded_at).to be_nil
        end
      end

      response "422", "anything but uploaded: true" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { uploaded: "yes" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Uploaded must be true" ])
        end
      end

      response "404", "another partner's photo" do
        schema "$ref" => "#/components/schemas/error"
        let(:photo) { create_photo(create(:listing), uploaded: false) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end

    delete "Delete a photo" do
      tags "Partner"
      description "Partner-only (RAA-106). Deletes the photo and its files; the listing's other photos keep their order."
      security [ { bearer: [] } ]

      response "204", "deleted, with its files" do
        run_test! do
          expect(ListingPhoto.exists?(photo.id)).to be(false)
          expect(ListingPhotos::DeleteFilesJob).to have_been_enqueued.with(
            %w[image image_card image_large].map { |field| "test/listing_photos/#{photo.id}/#{field}.jpg" }
          )
        end
      end

      response "404", "a photo of another partner's listing" do
        schema "$ref" => "#/components/schemas/error"
        let(:listing) { create(:listing) }

        run_test! { expect(ListingPhoto.exists?(photo.id)).to be(true) }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }
        let(:listing) { create(:listing) }

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
