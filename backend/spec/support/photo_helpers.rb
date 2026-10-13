# An uploaded, not yet attached photo (RAA-106), as a browser leaves one after a direct upload:
# its content type is the one the browser declared, not sniffed from the bytes.
module PhotoHelpers
  def uploaded_photo(filename: "photo.jpg", content_type: "image/jpeg")
    ActiveStorage::Blob.create_and_upload!(io: file_fixture("photo.jpg").open, filename:, content_type:, identify: false)
  end
end

RSpec.configure do |config|
  config.include PhotoHelpers
end
