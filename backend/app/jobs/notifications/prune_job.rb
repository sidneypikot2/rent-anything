module Notifications
  # Deletes notifications read more than RETENTION ago. Daily, from config/recurring.yml.
  class PruneJob < ApplicationJob
    RETENTION = 90.days

    queue_as :default

    def perform
      Notification.where(read_at: ...RETENTION.ago).in_batches(of: 1_000).delete_all
    end
  end
end
