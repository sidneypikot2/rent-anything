# Complete sample listings (RAA-115): a listing goes live only with a ready photo, a
# description, a price (stays and tours) and an activity's route, and the sample partners'
# (@example.com) live listings had no photos and their stays and tours no price. So each
# sample partner gets an approved ID check (no Didit session), each of their live listings a
# photo from db/sample_photos/ added the way a partner's upload is (ListingPhotos::Create,
# the file at its key, ListingPhotos::Update, ListingPhotos::ResizeJob), and a price where it
# had none. db/seeds.rb runs the same for a database loaded from schema.rb. Run again, it
# changes nothing.
class CompleteSampleListings < ActiveRecord::Migration[8.1]
  PHOTOS_DIR = Rails.root.join("db/sample_photos")
  # The photo for a category's slug; anything else gets the viewpoint.
  PHOTOS = {
    "snorkel-gear" => "snorkeling.jpg",
    "camera" => "photography.jpg",
    "action-camera" => "photography.jpg",
    "motorcycle" => "scooters.jpg",
    "tour" => "island.jpg",
    "van" => "viewpoint.jpg"
  }.freeze
  STAY_PHOTO = "cottages.jpg"
  OTHER_PHOTO = "viewpoint.jpg"
  NIGHTLY_PRICE_CENTS = 250_000
  TOUR_PRICE_CENTS = 150_000
  DESCRIPTION = "A sample listing to show how the site works."

  def self.complete
    partners = User.where(role: "partner").where("email LIKE ?", "%@example.com")
    partners.each { |partner| verify(partner) }

    Listing.active.where(partner: partners).includes(:category, :stay_rate, :tour_detail, :photos).find_each do |listing|
      listing.update_columns(description: DESCRIPTION) if listing.description.blank?
      listing.stay_rate.update!(nightly_price_cents: NIGHTLY_PRICE_CENTS) if listing.stay_rate&.nightly_price_cents&.zero?
      listing.tour_detail.update!(base_price_cents: TOUR_PRICE_CENTS) if listing.tour_detail&.base_price_cents&.zero?
      add_photo(listing) unless listing.photos.any?(&:ready?)
    end
  end

  def self.verify(partner)
    return if partner.id_verified?

    verification = partner.partner_verification || partner.build_partner_verification
    verification.update!(status: "approved", verified_at: Time.current)
  end

  def self.add_photo(listing)
    path = PHOTOS_DIR.join(photo_name(listing.category))
    photo, _upload = ListingPhotos::Create.call(listing, {
      filename: path.basename.to_s, byte_size: path.size, checksum: Digest::MD5.file(path).base64digest,
      content_type: "image/jpeg"
    })
    # Where the browser's PUT to the signed URL puts the bytes.
    path.open("rb") { |file| PhotoStorage.upload(photo.key, file, content_type: photo.content_type) }
    ListingPhotos::Update.call(photo, { uploaded: true })
    # Ready now rather than when the queue gets to it, so the listing can stay live.
    ListingPhotos::ResizeJob.perform_now(photo)
  end

  def self.photo_name(category)
    return STAY_PHOTO if category.accommodation?

    PHOTOS.fetch(category.slug, OTHER_PHOTO)
  end

  def up
    self.class.complete
  end

  # The sample photos, prices and checks stay: they are sample data, not schema.
  def down; end
end
