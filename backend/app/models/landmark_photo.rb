# One of a landmark's photos (RAA-210), numbered from 1 in the team's order; the first ready one
# is its card's. Set in the admin console through GalleryPhotos, and stored and readied as
# StoredPhoto describes, at <root>/landmark_photos/<id>/image.jpg.
class LandmarkPhoto < ApplicationRecord
  include StoredPhoto

  belongs_to :landmark

  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
end
