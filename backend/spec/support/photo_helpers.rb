# Listing photos (RAA-106) without a bucket: every spec gets a stubbed S3 client, so nothing
# reaches R2. stub_photo_in_storage makes a file "exist" and downloadable; the rest of the
# client's calls succeed with empty answers, and PhotoStorage.client.api_requests lists them.
module PhotoHelpers
  # A photo as ListingPhotos::Create leaves it, then the confirmed upload and ResizeJob.
  def create_photo(listing, position: listing.photos.maximum(:position).to_i + 1, uploaded: true, ready: uploaded,
    **attributes)
    listing.photos.create!(position:, filename: "photo.jpg", content_type: "image/jpeg", byte_size: 505,
      checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", uploaded_at: (Time.current if uploaded), sized_at: (Time.current if ready),
      **attributes)
  end

  def stub_photo_in_storage(bytes = file_fixture("photo.jpg").binread)
    PhotoStorage.client.stub_responses(:head_object, {})
    PhotoStorage.client.stub_responses(:get_object, ->(_) { { body: bytes } })
  end

  # What each put_object sent, by key, read before the job closes the file.
  def capture_uploads
    {}.tap do |uploads|
      PhotoStorage.client.stub_responses(:put_object, lambda { |context|
        uploads[context.params[:key]] = context.params[:body].read
        {}
      })
    end
  end

  def stub_photo_missing
    PhotoStorage.client.stub_responses(:head_object, "NotFound")
  end

  def storage_requests(operation)
    PhotoStorage.client.api_requests.select { |request| request[:operation_name] == operation }
  end
end

RSpec.configure do |config|
  config.include PhotoHelpers

  config.before do
    PhotoStorage.instance_variable_set(:@client, Aws::S3::Client.new(stub_responses: true, region: "auto"))
  end
end
