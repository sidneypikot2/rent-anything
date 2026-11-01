module GalleryPhotos
  # The team confirms an area's or a landmark's photo upload (RAA-210), as ListingPhotos::Update
  # does for a listing's, and/or moves it to another place in the order: `position` 1 makes it
  # the banner, and the others shift to make room. Replacing a photo is adding the new one,
  # moving it to the old one's place and deleting the old.
  class Update < ApplicationService
    def initialize(owner, photo, params)
      @owner = owner
      @photo = photo
      @params = params
    end

    def call
      unless @params.key?(:uploaded) || @params.key?(:position)
        @photo.errors.add(:base, "Send uploaded or position")
        raise ActiveRecord::RecordInvalid, @photo
      end

      ListingPhotos::Update.call(@photo, @params.slice(:uploaded)) if @params.key?(:uploaded)
      move if @params.key?(:position)
      @photo.reload
    end

    private

    def move
      @owner.with_lock do
        photos = @owner.photos.to_a
        position = @params[:position]
        unless position.is_a?(Integer) && position.between?(1, photos.size)
          @photo.errors.add(:base, "Position must be a whole number from 1 to #{photos.size}")
          raise ActiveRecord::RecordInvalid, @photo
        end

        photos.delete(@photo)
        GalleryPhotos.renumber!(photos.insert(position - 1, @photo))
      end
    end
  end
end
