module ListingPhotos
  # Deletes photos whose upload was never confirmed (RAA-106), such as one from a tab the
  # partner closed mid-upload, once they are AGE old, with whatever file reached storage. Area
  # banners (RAA-164) too. Daily, from config/recurring.yml.
  class PurgeUnfinishedJob < ApplicationJob
    queue_as :default

    AGE = 2.days

    def perform
      [ ListingPhoto, AreaPhoto ].each do |model|
        model.where(uploaded_at: nil, created_at: ...AGE.ago).find_each(&:destroy!)
      end
    end
  end
end
