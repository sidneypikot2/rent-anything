# An area's or a landmark's photos (RAA-210), set by the team in the admin console: AreaPhoto
# and LandmarkPhoto, numbered 1..n in order, the first being the banner or the card's photo.
module GalleryPhotos
  MAX = 12

  # Writes the owner's photos' positions as the given order, 1..n. The unique order is checked
  # at commit, so positions can pass through each other here. Call inside the owner's lock.
  def self.renumber!(photos)
    photos.each.with_index(1) do |photo, position|
      photo.update_columns(position:, updated_at: Time.current) unless photo.position == position
    end
  end
end
