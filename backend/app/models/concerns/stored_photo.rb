# A photo whose file is in R2 (RAA-106): the row is made before the file exists, so the file
# goes straight to its key, <root>/<table>/<id>/<field>.<extension>. Once the upload is
# confirmed (uploaded_at), ListingPhotos::ResizeJob strips the original's metadata and makes
# image_card and image_large next to it (sized_at). Its files go once the row is gone.
# ListingPhoto, AreaPhoto (RAA-164) and LandmarkPhoto (RAA-210).
module StoredPhoto
  extend ActiveSupport::Concern

  CONTENT_TYPES = %w[image/jpeg image/png image/webp].freeze
  EXTENSIONS = { "image/jpeg" => "jpg", "image/png" => "png", "image/webp" => "webp" }.freeze
  FIELDS = %i[image image_card image_large].freeze
  MAX_BYTES = 10.megabytes
  # The most pixels ResizeJob decodes (RAA-221): a 10 MB PNG can hold gigapixels (a
  # decompression bomb) and exhaust the worker's memory. 50 MP is well above any phone camera.
  MAX_PIXELS = 50_000_000
  # What a file's first bytes are for each type (RAA-221): the browser declares the type, the
  # confirm checks the file agrees.
  SIGNATURES = {
    "image/jpeg" => ->(bytes) { bytes.start_with?("\xFF\xD8\xFF".b) },
    "image/png" => ->(bytes) { bytes.start_with?("\x89PNG\r\n\x1A\n".b) },
    "image/webp" => ->(bytes) { bytes.byteslice(0, 4) == "RIFF" && bytes.byteslice(8, 4) == "WEBP" }
  }.freeze

  included do
    scope :ready, -> { where.not(sized_at: nil) }

    validates :filename, presence: true, length: { maximum: 255 }
    validates :content_type, inclusion: { in: CONTENT_TYPES }
    validates :byte_size, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: MAX_BYTES }
    validates :checksum, presence: true

    after_destroy_commit { ListingPhotos::DeleteFilesJob.perform_later(FIELDS.map { |field| key(field) }) }
  end

  # Where a file of this photo is in the bucket, the root being the environment
  # (PhotoStorage.root).
  def key(field = :image)
    "#{PhotoStorage.root}/#{self.class.table_name}/#{id}/#{field}.#{EXTENSIONS.fetch(content_type)}"
  end

  # Whether a file starting with these bytes (PhotoStorage.read_start) is the type declared.
  def signature_matches?(bytes)
    SIGNATURES.fetch(content_type).call(bytes.b)
  end

  # A file that isn't the image it was declared as, or too big to decode (RAA-221): its files
  # go from the public bucket now rather than after the commit, and the row with them. Its
  # owner's positions keep the gap, as after PurgeUnfinishedJob.
  def reject!
    PhotoStorage.delete(FIELDS.map { |field| key(field) })
    destroy!
  end

  def uploaded?
    uploaded_at.present?
  end

  def ready?
    sized_at.present?
  end
end
