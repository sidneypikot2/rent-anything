module GalleryPhotos
  # The team adds a photo to an area or a landmark (RAA-210), the way a partner adds a listing
  # photo (ListingPhotos::Create): the row first, after the others, so the file's key is known;
  # the browser then PUTs the bytes to storage and confirms with GalleryPhotos::Update. Guests
  # don't see it until it is ready, and one never confirmed is deleted by
  # ListingPhotos::PurgeUnfinishedJob.
  class Create < ApplicationService
    include PhotoUploadValues

    def initialize(owner, params)
      @owner = owner
      @params = params
      @errors = []
    end

    def call
      photo = @owner.photos.build(**upload_attributes)
      raise_invalid!(photo) if @errors.any?

      # Two adds at once would both count one under the limit and take the same position.
      @owner.with_lock do
        if @owner.photos.count >= MAX
          upload_error("#{@owner.is_a?(Area) ? 'A destination' : 'A place to see'} can have at most #{MAX} photos")
          raise_invalid!(photo)
        end
        photo.update!(position: @owner.photos.maximum(:position).to_i + 1)
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
