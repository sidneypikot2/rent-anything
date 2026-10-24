module ListingPhotos
  # A partner adds a photo to one of their listings (RAA-106). The row comes first, after the
  # listing's others, so the file's key is known; the browser then PUTs the bytes straight to
  # storage, at a URL signed for exactly that type, size and MD5, and confirms with
  # ListingPhotos::Update. Guests don't see it until then, and one never confirmed is deleted
  # by ListingPhotos::PurgeUnfinishedJob.
  class Create < ApplicationService
    include PhotoUploadValues

    def initialize(listing, params)
      @listing = listing
      @params = params
      @errors = []
    end

    def call
      raise NotAuthorizedError, "Verify your ID before adding photos" unless @listing.partner.id_verified?

      photo = @listing.photos.build(**upload_attributes)
      raise_invalid!(photo) if @errors.any?

      Listing.transaction do
        # Two adds at once would both count one under the limit and take the same position.
        Listing.where(id: @listing.id).lock.pluck(:id)
        limit = @listing.photo_limit
        if @listing.photos.count >= limit
          upload_error("#{@listing.category.tour? ? 'A tour' : 'A listing'} can have at most #{limit} photos")
          raise_invalid!(photo)
        end
        photo.update!(position: @listing.photos.maximum(:position).to_i + 1)
      end
      [ photo, upload_url(photo) ]
    end

    private

    def raise_invalid!(photo)
      @errors.each { |message| photo.errors.add(:base, message) }
      raise ActiveRecord::RecordInvalid, photo
    end
  end
end
