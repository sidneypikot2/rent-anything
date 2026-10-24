# An area's banner photo (RAA-164), one per area, set by the team in the admin console.
# Stored and readied as StoredPhoto describes, at <root>/area_photos/<id>/image.jpg.
class AreaPhoto < ApplicationRecord
  include StoredPhoto

  belongs_to :area
end
