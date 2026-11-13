# A photo whose file is in R2 (RAA-106): the row is made before the file exists, so the file
# goes straight to its key, <root>/<table>/<id>/<field>.<extension>. Once the upload is
# confirmed (uploaded_at), ListingPhotos::ResizeJob strips the original's metadata and makes
# image_card and image_large next to it (sized_at), as WebP since RAA-240 (versions_content_type).
# Its files go once the row is gone. ListingPhoto, AreaPhoto (RAA-164), LandmarkPhoto (RAA-210),
# BusinessPhoto and BusinessLogo (RAA-281).
module StoredPhoto
  extend ActiveSupport::Concern

  CONTENT_TYPES = %w[image/jpeg image/png image/webp].freeze
  EXTENSIONS = { "image/jpeg" => "jpg", "image/png" => "png", "image/webp" => "webp" }.freeze
  FIELDS = %i[image image_card image_large].freeze
  # The sizes' format (RAA-240): guests download these, and WebP is smaller than a JPEG at the
  # same look, and far smaller than a PNG (ResizeJob). A photo sized before it (versions_content_type NULL) keeps its sizes
  # in the original's format until ResizeJob gives it WebP ones (bin/rails photos:webp_sizes).
  VERSIONS_CONTENT_TYPE = "image/webp"
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
    scope :sizes_outdated, -> { ready.where("versions_content_type IS DISTINCT FROM ?", VERSIONS_CONTENT_TYPE) }

    validates :filename, presence: true, length: { maximum: 255 }
    validates :content_type, inclusion: { in: CONTENT_TYPES }
    validates :byte_size, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: MAX_BYTES }
    validates :checksum, presence: true
    validates :versions_content_type, inclusion: { in: CONTENT_TYPES }, allow_nil: true

    after_destroy_commit { ListingPhotos::DeleteFilesJob.perform_later(file_keys) }
  end

  # Where a file of this photo is in the bucket, the root being the environment
  # (PhotoStorage.root). The original keeps its own format; the sizes are in theirs.
  def key(field = :image, type = field == :image ? content_type : versions_content_type || content_type)
    "#{PhotoStorage.root}/#{self.class.table_name}/#{id}/#{field}.#{EXTENSIONS.fetch(type)}"
  end

  # Every key this photo may have a file at: its sizes in the original's format (made before
  # RAA-240, and kept when it got WebP ones) and as WebP. Keys never written are skipped.
  def file_keys
    sizes = FIELDS - [ :image ]
    [ key(:image), *sizes.map { |field| key(field, content_type) }, *sizes.map { |field| key(field, VERSIONS_CONTENT_TYPE) } ].uniq
  end

  def sizes_outdated?
    ready? && versions_content_type != VERSIONS_CONTENT_TYPE
  end

  # Whether a file starting with these bytes (PhotoStorage.read_start) is the type declared.
  def signature_matches?(bytes)
    SIGNATURES.fetch(content_type).call(bytes.b)
  end

  # A file that isn't the image it was declared as, or too big to decode (RAA-221): its files
  # go from the public bucket now rather than after the commit, and the row with them. Its
  # owner's positions keep the gap, as after PurgeUnfinishedJob.
  def reject!
    PhotoStorage.delete(file_keys)
    destroy!
  end

  def uploaded?
    uploaded_at.present?
  end

  def ready?
    sized_at.present?
  end
end
