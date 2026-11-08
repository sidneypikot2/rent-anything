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
        max = @owner.is_a?(Business) ? Business::MAX_COVER_PHOTOS : MAX
        if @owner.photos.count >= max
          owner = { Area => "A destination", Business => "A business" }.fetch(@owner.class, "A place to see")
          upload_error("#{owner} can have at most #{max} #{@owner.is_a?(Business) ? 'cover photos' : 'photos'}")
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
