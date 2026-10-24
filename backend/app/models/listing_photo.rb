# One of a listing's photos (RAA-106), numbered from 1 in the partner's order; the first
# ready one is the cover. Stored and readied as StoredPhoto describes, at
# <root>/listing_photos/<id>/image.jpg. Guests see it only once it is ready, from the
# bucket's public URL (ListingPhotoSerializer), never through this API. Deleting a listing
# deletes its photos one by one (Listing#photos) so their files go too; the foreign key's
# cascade alone would leave them.
class ListingPhoto < ApplicationRecord
  include StoredPhoto

  MAX_PER_LISTING = 12
  # A tour's carousel (RAA-110): Listing#photo_limit picks between them.
  MAX_PER_TOUR = 5

  belongs_to :listing

  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
end
