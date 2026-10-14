# One of a listing's photos (RAA-106), numbered from 1 in the partner's order; the first
# ready one is the cover. The row is made before the file exists (ListingPhotos::Create),
# so the file goes straight to its key: <root>/listing_photos/<id>/image.jpg. Once the upload
# is confirmed (uploaded_at), ListingPhotos::ResizeJob strips the original's metadata and
# makes image_card and image_large next to it (sized_at). Only then do guests see it, from
# the bucket's public URL (ListingPhotoSerializer), never through this API.
class ListingPhoto < ApplicationRecord
  CONTENT_TYPES = %w[image/jpeg image/png image/webp].freeze
  EXTENSIONS = { "image/jpeg" => "jpg", "image/png" => "png", "image/webp" => "webp" }.freeze
  FIELDS = %i[image image_card image_large].freeze
  MAX_BYTES = 10.megabytes
  MAX_PER_LISTING = 12

  belongs_to :listing

  scope :ready, -> { where.not(sized_at: nil) }

  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
  validates :filename, presence: true, length: { maximum: 255 }
  validates :content_type, inclusion: { in: CONTENT_TYPES }
  validates :byte_size, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: MAX_BYTES }
  validates :checksum, presence: true

  # Its files go once the row is gone. Deleting a listing deletes its photos one by one
  # (Listing#photos) so this runs; the foreign key's cascade alone would leave the files.
  after_destroy_commit { ListingPhotos::DeleteFilesJob.perform_later(FIELDS.map { |field| key(field) }) }

  # Where a file of this photo is in the bucket: <root>/<table>/<id>/<field>.<extension>, the
  # root being the environment (PhotoStorage.root).
  def key(field = :image)
    "#{PhotoStorage.root}/#{self.class.table_name}/#{id}/#{field}.#{EXTENSIONS.fetch(content_type)}"
  end

  def uploaded?
    uploaded_at.present?
  end

  def ready?
    sized_at.present?
  end
end
