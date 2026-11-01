# One of an area's photos (RAA-210), numbered from 1 in the team's order; the first ready one is
# its banner (RAA-164 had just that one). Set in the admin console through GalleryPhotos, and
# stored and readied as StoredPhoto describes, at <root>/area_photos/<id>/image.jpg.
class AreaPhoto < ApplicationRecord
  include StoredPhoto

  belongs_to :area

  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
end
