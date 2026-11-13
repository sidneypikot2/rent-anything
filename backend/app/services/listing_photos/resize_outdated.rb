module ListingPhotos
  # Queues ResizeJob for every photo sized before WebP (RAA-240, StoredPhoto#sizes_outdated?), of
  # every kind, a batch of jobs at a time, and says how many. Run again, it queues only those
  # still waiting, and a job for a photo done meanwhile does nothing.
  # `bin/rails photos:webp_sizes` runs it.
  class ResizeOutdated < ApplicationService
    MODELS = [ ListingPhoto, AreaPhoto, LandmarkPhoto, BusinessPhoto, BusinessLogo ].freeze

    def initialize(batch_size: 100)
      @batch_size = batch_size
    end

    def call
      MODELS.sum do |model|
        model.sizes_outdated.in_batches(of: @batch_size).sum do |batch|
          jobs = batch.map { |photo| ResizeJob.new(photo) }
          ActiveJob.perform_all_later(jobs)
          jobs.size
        end
      end
    end
  end
end
