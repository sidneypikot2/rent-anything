module GalleryPhotos
  # The team deletes one of an area's or a landmark's photos (RAA-210); the ones after it move up,
  # so the next becomes the banner when it was the first. Its files go from storage after the
  # commit (StoredPhoto).
  class Destroy < ApplicationService
    def initialize(owner, photo)
      @owner = owner
      @photo = photo
    end

    def call
      @owner.with_lock do
        @photo.destroy!
        GalleryPhotos.renumber!(@owner.photos.reload.to_a)
      end
    end
  end
end
