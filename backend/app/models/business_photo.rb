# One of a business's cover photos (RAA-281), numbered from 1 in its partner's order; the first
# ready one leads its shop page. Set through GalleryPhotos, and stored and readied as StoredPhoto
# describes, at <root>/business_photos/<id>/image.jpg.
class BusinessPhoto < ApplicationRecord
  include StoredPhoto

  belongs_to :business

  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
end
