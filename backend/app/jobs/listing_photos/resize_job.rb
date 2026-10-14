require "image_processing/vips"

module ListingPhotos
  # Readies a photo once its upload is confirmed (RAA-106). The original is saved again
  # without its metadata, turned upright: a phone photo's EXIF can hold the GPS point of a
  # partner's home, which guests only learn after a paid booking. Then its two sizes are made
  # next to it from that copy: image_card fills 800 by 600 for cards, image_large fits
  # within 1600 for its page, in the original's format. Guests see the photo only once this
  # is done (sized_at). Run again, it does nothing.
  class ResizeJob < ApplicationJob
    queue_as :default

    VERSIONS = {
      image: ->(image) { image },
      image_card: ->(image) { image.resize_to_fill(800, 600) },
      image_large: ->(image) { image.resize_to_limit(1600, 1600) }
    }.freeze

    retry_on Aws::S3::Errors::ServiceError, Seahorse::Client::NetworkingError, wait: :polynomially_longer, attempts: 5
    discard_on ActiveJob::DeserializationError

    def perform(photo)
      return if photo.sized_at

      original = PhotoStorage.download(photo.key)
      # The original is replaced first, so a retry after a failure starts from the clean copy.
      VERSIONS.each do |field, resize|
        version = resize.call(ImageProcessing::Vips.source(original).saver(strip: true, quality: 90)).call
        PhotoStorage.upload(photo.key(field), version, content_type: photo.content_type)
      ensure
        version&.close!
      end
      photo.update!(sized_at: Time.current)
    ensure
      original&.close!
    end
  end
end
