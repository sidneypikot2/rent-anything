module Guests
  # Deletes unregistered guests' trips 60 days after they end (Guests::Purge). Daily, from
  # config/recurring.yml.
  class PurgeJob < ApplicationJob
    queue_as :default

    def perform
      Guests::Purge.call
    end
  end
end
