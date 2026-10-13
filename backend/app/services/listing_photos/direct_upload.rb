module ListingPhotos
  # A partner starts uploading a listing photo (RAA-106): the blob is reserved here and the
  # browser PUTs the bytes straight to storage, at the signed URL the blob gives, which only
  # takes that size, type and MD5. Its signed_id then goes in a listing's photos. Rails' own
  # /rails/active_storage/direct_uploads is not used: it takes anyone's upload. A blob no
  # listing takes is purged by ListingPhotos::PurgeUnattachedJob.
  class DirectUpload < ApplicationService
    CHECKSUM = %r{\A[A-Za-z0-9+/]{22}==\z}

    def initialize(partner, params)
      @partner = partner
      @params = params
      @errors = []
    end

    def call
      raise NotAuthorizedError, "Verify your ID before adding photos" unless @partner.id_verified?

      attributes = {
        filename: filename,
        byte_size: byte_size,
        checksum: checksum,
        content_type: content_type
      }
      raise_invalid! if @errors.any?

      ActiveStorage::Blob.create_before_direct_upload!(**attributes)
    end

    private

    def filename
      value = @params[:filename]
      return value.strip if value.is_a?(String) && value.strip.present? && value.length <= 255

      error("File name is required")
    end

    def byte_size
      value = @params[:byte_size]
      return error("Size must be a whole number of bytes") unless value.is_a?(Integer) && value.positive?
      return error("Photo must be at most 10 MB") if value > ListingPhoto::MAX_BYTES

      value
    end

    def checksum
      value = @params[:checksum]
      value.is_a?(String) && value.match?(CHECKSUM) ? value : error("Checksum must be a base64 MD5")
    end

    def content_type
      value = @params[:content_type]
      ListingPhoto::CONTENT_TYPES.include?(value) ? value : error("Photo must be a JPEG, PNG or WebP image")
    end

    def raise_invalid!
      blob = ActiveStorage::Blob.new
      @errors.each { |message| blob.errors.add(:base, message) }
      raise ActiveRecord::RecordInvalid, blob
    end

    def error(message)
      @errors << message
      nil
    end
  end
end
