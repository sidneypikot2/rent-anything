module ListingPhotos
  # A partner adds a photo to one of their listings (RAA-106). The row comes first, after the
  # listing's others, so the file's key is known; the browser then PUTs the bytes straight to
  # storage, at a URL signed for exactly that type, size and MD5, and confirms with
  # ListingPhotos::Update. Guests don't see it until then, and one never confirmed is deleted
  # by ListingPhotos::PurgeUnfinishedJob.
  class Create < ApplicationService
    CHECKSUM = %r{\A[A-Za-z0-9+/]{22}==\z}

    def initialize(listing, params)
      @listing = listing
      @params = params
      @errors = []
    end

    def call
      raise NotAuthorizedError, "Verify your ID before adding photos" unless @listing.partner.id_verified?

      attributes = { filename:, byte_size:, checksum:, content_type: }
      photo = @listing.photos.build(**attributes)
      raise_invalid!(photo) if @errors.any?

      Listing.transaction do
        # Two adds at once would both count one under the limit and take the same position.
        Listing.where(id: @listing.id).lock.pluck(:id)
        limit = @listing.photo_limit
        if @listing.photos.count >= limit
          error("#{@listing.category.tour? ? 'A tour' : 'A listing'} can have at most #{limit} photos")
          raise_invalid!(photo)
        end
        photo.update!(position: @listing.photos.maximum(:position).to_i + 1)
      end
      [ photo, PhotoStorage.upload_url(photo.key, content_type: photo.content_type, byte_size: photo.byte_size,
        checksum: photo.checksum) ]
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

    def raise_invalid!(photo)
      @errors.each { |message| photo.errors.add(:base, message) }
      raise ActiveRecord::RecordInvalid, photo
    end

    def error(message)
      @errors << message
      nil
    end
  end
end
