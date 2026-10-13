# A listing photo's URLs (the `photo_urls` and `partner_photo` schemas in
# spec/swagger_helper.rb, RAA-106). On R2 they are the bucket's public URL (R2_PUBLIC_URL)
# plus the object's key, so a guest's browser loads them from Cloudflare without waking this
# API; until a size has been made, just after upload, it is the original's key. Elsewhere
# (the local disk, specs) they are Active Storage's redirect URLs, which make the size on
# first use, on BACKEND_PUBLIC_URL when set: server-rendered pages fetch from inside Docker,
# so the request's own host isn't one the browser can reach. Preload ListingPhoto::WITH_IMAGE.
module ListingPhotoSerializer
  def self.call(photo)
    { card_url: url(photo, :card), large_url: url(photo, :large) }
  end

  # The signed id is what a listing's photos take, so a partner can keep or reorder it.
  def self.partner(photo)
    { id: photo.image.blob.signed_id, **call(photo) }
  end

  def self.cover_url(listing)
    photo = listing.photos.first
    photo && url(photo, :card)
  end

  def self.url(photo, size)
    variant = photo.image.variant(size)
    base = public_base
    return "#{base}/#{variant.key || photo.image.key}" if base

    Rails.application.routes.url_helpers.rails_representation_url(variant, **url_options)
  end

  def self.public_base
    return unless Rails.configuration.active_storage.service == :cloudflare

    ENV["R2_PUBLIC_URL"].presence&.chomp("/")
  end

  def self.url_options
    base = ENV["BACKEND_PUBLIC_URL"].presence
    base ? { host: base } : ActiveStorage::Current.url_options
  end
end
