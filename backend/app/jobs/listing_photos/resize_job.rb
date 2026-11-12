require "image_processing/vips"

module ListingPhotos
  # Readies a photo once its upload is confirmed (RAA-106). The original is saved again
  # without its metadata, turned upright: a phone photo's EXIF can hold the GPS point of a
  # partner's home, which guests only learn after a paid booking. Then its two sizes are made
  # next to it from that copy: image_card fills 800 by 600 for cards, image_large fits
  # within 1600 for its page, in the original's format. Guests see the photo only once this
  # is done (sized_at). Run again, it does nothing. A file libvips can't read, or one over
  # StoredPhoto::MAX_PIXELS (a decompression bomb), is deleted, row and all, before anything is
  # decoded (RAA-221): it never becomes ready, and the partner no longer sees it.
  class ResizeJob < ApplicationJob
    queue_as :default

    # The sizes guests download are saved at a lower JPEG quality than the kept original: at 90 a
    # card was ~250 KB, the bulk of an area page's weight on a phone, with no visible gain at its
    # size. (A PNG ignores quality.)
    VERSIONS = {
      image: [ ->(image) { image }, 90 ],
      image_card: [ ->(image) { image.resize_to_fill(800, 600) }, 78 ],
      image_large: [ ->(image) { image.resize_to_limit(1600, 1600) }, 80 ]
    }.freeze

    retry_on Aws::S3::Errors::ServiceError, Seahorse::Client::NetworkingError, wait: :polynomially_longer, attempts: 5
    discard_on ActiveJob::DeserializationError

    def perform(photo)
      return if photo.sized_at

      original = PhotoStorage.download(photo.key)
      return photo.reject! unless decodable?(original)

      # The original is replaced first, so a retry after a failure starts from the clean copy.
      VERSIONS.each do |field, (resize, quality)|
        source = ImageProcessing::Vips.source(original).loader(fail: true)
        version = resize.call(source.saver(strip: true, quality:)).call
        PhotoStorage.upload(photo.key(field), version, content_type: photo.content_type)
      ensure
        version&.close!
      end
      photo.update!(sized_at: Time.current)
    rescue Vips::Error
      photo.reject!
    ensure
      original&.close!
    end

    private

    # Opening reads only the header, so the size is known before any pixel is decoded.
    def decodable?(file)
      image = Vips::Image.new_from_file(file.path, access: :sequential, fail: true)
      image.width * image.height <= StoredPhoto::MAX_PIXELS
    end
  end
end
