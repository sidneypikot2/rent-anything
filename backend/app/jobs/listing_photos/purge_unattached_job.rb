module ListingPhotos
  # Deletes uploads no listing took, such as photos from a listing wizard the partner left
  # before saving (RAA-106), once they are AGE old. Daily, from config/recurring.yml. A
  # photo's sizes are attached to their variant records, so they never count as unattached.
  class PurgeUnattachedJob < ApplicationJob
    queue_as :default

    AGE = 2.days

    def perform
      ActiveStorage::Blob.unattached.where(created_at: ...AGE.ago).find_each(&:purge_later)
    end
  end
end
