# A listing photo's URLs (the `photo_urls` and `partner_photo` schemas in
# spec/swagger_helper.rb, RAA-106): the bucket's public URL (R2_PUBLIC_URL) plus the file's
# key, so a guest's browser loads them from Cloudflare without waking this API. Guests only
# get ready photos; a partner's photo that ListingPhotos::ResizeJob hasn't readied yet points
# both at the original.
module ListingPhotoSerializer
  def self.call(photo)
    ready = photo.ready?
    {
      card_url: PhotoStorage.public_url(photo.key(ready ? :image_card : :image)),
      large_url: PhotoStorage.public_url(photo.key(ready ? :image_large : :image))
    }
  end

  # The id is what a listing's photos take, so a partner can keep or reorder it. A photo
  # still uploading has no file to show yet, and one not ready isn't shown to guests yet.
  def self.partner(photo)
    { id: photo.id, uploaded: photo.uploaded?, ready: photo.ready?, **call(photo) }
  end

  # Preload cover_photo.
  def self.cover_url(listing)
    photo = listing.cover_photo
    photo && call(photo)[:card_url]
  end
end
