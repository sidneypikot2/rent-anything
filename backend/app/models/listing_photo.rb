# One of a listing's photos (RAA-106), numbered from 1 in the partner's order; the first is
# the cover. The image is uploaded by the browser straight to storage (Cloudflare R2) before
# the listing is saved (ListingPhotos::DirectUpload), then attached by Listings::Create or
# Update. Both sizes are made once, in a job, right after it is attached; guests load them
# from the bucket's public URL (ListingPhotoSerializer), never through this API.
class ListingPhoto < ApplicationRecord
  CONTENT_TYPES = %w[image/jpeg image/png image/webp].freeze
  MAX_BYTES = 10.megabytes
  MAX_PER_LISTING = 12
  # What a list of photos needs to build its URLs without a query per photo.
  WITH_IMAGE = { image_attachment: { blob: { variant_records: { image_attachment: :blob } } } }.freeze

  belongs_to :listing

  has_one_attached :image do |image|
    image.variant :card, resize_to_fill: [ 800, 600 ], preprocessed: true
    image.variant :large, resize_to_limit: [ 1600, 1600 ], preprocessed: true
  end

  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
  validate :image_is_a_photo

  private

  def image_is_a_photo
    return errors.add(:image, "is required") unless image.attached?

    errors.add(:image, "must be a JPEG, PNG or WebP image") unless CONTENT_TYPES.include?(image.blob.content_type)
    errors.add(:image, "must be at most 10 MB") if image.blob.byte_size > MAX_BYTES
  end
end
