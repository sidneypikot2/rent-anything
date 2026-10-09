module SearchEvents
  # Deletes search events older than SearchEvent::RETENTION (90 days). Nightly, from
  # config/recurring.yml.
  class PruneJob < ApplicationJob
    queue_as :default

    def perform
      SearchEvent.where(created_at: ...SearchEvent::RETENTION.ago).delete_all
    end
  end
end
