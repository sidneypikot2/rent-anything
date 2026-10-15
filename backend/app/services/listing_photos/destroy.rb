module ListingPhotos
  # A partner deletes one of a listing's photos (RAA-106). A live listing keeps at least one
  # ready photo (RAA-115): deleting its last one is refused until it is paused. Its files go
  # from storage after the commit (ListingPhoto).
  class Destroy < ApplicationService
    def initialize(listing, photo)
      @listing = listing
      @photo = photo
    end

    def call
      @listing.with_lock do
        blockers = @listing.live_blockers
        @photo.destroy!
        @listing.reload.check_still_live!(blockers)
      end
    end
  end
end
