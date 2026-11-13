require "image_processing/vips"

module ListingPhotos
  # Readies a photo once its upload is confirmed (RAA-106). The original is saved again
  # without its metadata, turned upright: a phone photo's EXIF can hold the GPS point of a
  # partner's home, which guests only learn after a paid booking. Then its two sizes are made
  # next to it from that copy: image_card fills 800 by 600 for cards, image_large fits
  # within 1600 for its page, both as WebP (RAA-240, StoredPhoto::VERSIONS_CONTENT_TYPE).
  # Guests see the photo only once this is done (sized_at). Run again, it does nothing. A file
  # libvips can't read, or one over StoredPhoto::MAX_PIXELS (a decompression bomb), is deleted,
  # row and all, before anything is decoded (RAA-221): it never becomes ready, and the partner
  # no longer sees it.
  #
  # A photo sized before RAA-240 (StoredPhoto#sizes_outdated?) gets only its WebP sizes, from
  # its already-stripped original, which is left as it is; its old sizes stay next to them for
  # pages that still link them (StoredPhoto#file_keys deletes them with the photo).
  class ResizeJob < ApplicationJob
    queue_as :default

    # The original is re-saved at a high quality in its own format; the sizes guests download as
    # WebP at 80 whatever the upload was. Measured on two photos (RAA-240): 5-13% smaller than
    # the JPEG sizes at 78/80 (RAA-277) they replace, and about 90% smaller than a PNG upload's,
    # which used to stay PNG. WebP keeps a PNG logo's transparency.
    ORIGINAL_QUALITY = 90
    SIZES = {
      image_card: ->(image) { image.resize_to_fill(800, 600) },
      image_large: ->(image) { image.resize_to_limit(1600, 1600) }
    }.freeze
    SIZE_QUALITY = 80

    retry_on Aws::S3::Errors::ServiceError, Seahorse::Client::NetworkingError, wait: :polynomially_longer, attempts: 5
    discard_on ActiveJob::DeserializationError

    def perform(photo)
      return if photo.ready? && !photo.sizes_outdated?

      original = PhotoStorage.download(photo.key)
      return reject(photo) unless decodable?(original)

      # The original is replaced first, so a retry after a failure starts from the clean copy.
      original = strip(photo, original) unless photo.ready?
      SIZES.each do |field, resize|
        size = resize.call(source(original).convert("webp").saver(strip: true, quality: SIZE_QUALITY)).call
        PhotoStorage.upload(photo.key(field, StoredPhoto::VERSIONS_CONTENT_TYPE), size,
          content_type: StoredPhoto::VERSIONS_CONTENT_TYPE)
      ensure
        size&.close!
      end
      photo.update!(sized_at: photo.sized_at || Time.current, versions_content_type: StoredPhoto::VERSIONS_CONTENT_TYPE)
    rescue Vips::Error
      reject(photo)
    ensure
      original&.close!
    end

    private

    # Opening reads only the header, so the size is known before any pixel is decoded.
    def decodable?(file)
      image = Vips::Image.new_from_file(file.path, access: :sequential, fail: true)
      image.width * image.height <= StoredPhoto::MAX_PIXELS
    end

    def source(file)
      ImageProcessing::Vips.source(file).loader(fail: true)
    end

    # The original without its metadata, saved over the upload; the sizes are made from it.
    def strip(photo, original)
      stripped = source(original).saver(strip: true, quality: ORIGINAL_QUALITY).call
      PhotoStorage.upload(photo.key, stripped, content_type: photo.content_type)
      original.close!
      stripped.tap(&:rewind)
    end

    # A photo guests already see is never deleted for a file that fails now: it keeps its old
    # sizes and is tried again on the next run.
    def reject(photo)
      return photo.reject! unless photo.ready?

      Rails.logger.warn("ListingPhotos::ResizeJob: #{photo.class.name} #{photo.id} could not be given WebP sizes")
    end
  end
end
