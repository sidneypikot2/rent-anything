# What a browser declares about a photo before uploading it (RAA-106): its name, size, MD5
# and type, read without coercion; a wrong value adds to @errors. Shared by listing photos and
# area banners (RAA-164), which StoredPhoto keeps alike.
module PhotoUploadValues
  CHECKSUM = %r{\A[A-Za-z0-9+/]{22}==\z}

  private

  def upload_attributes
    { filename:, byte_size:, checksum:, content_type: }
  end

  def filename
    value = @params[:filename]
    return value.strip if value.is_a?(String) && value.strip.present? && value.length <= 255

    upload_error("File name is required")
  end

  def byte_size
    value = @params[:byte_size]
    return upload_error("Size must be a whole number of bytes") unless value.is_a?(Integer) && value.positive?
    return upload_error("Photo must be at most 10 MB") if value > StoredPhoto::MAX_BYTES

    value
  end

  def checksum
    value = @params[:checksum]
    value.is_a?(String) && value.match?(CHECKSUM) ? value : upload_error("Checksum must be a base64 MD5")
  end

  def content_type
    value = @params[:content_type]
    StoredPhoto::CONTENT_TYPES.include?(value) ? value : upload_error("Photo must be a JPEG, PNG or WebP image")
  end

  def upload_error(message)
    @errors << message
    nil
  end

  # Where the browser PUTs the photo's bytes: a URL signed for exactly its key, type, size and MD5.
  def upload_url(photo)
    PhotoStorage.upload_url(photo.key, content_type: photo.content_type, byte_size: photo.byte_size, checksum: photo.checksum)
  end
end
