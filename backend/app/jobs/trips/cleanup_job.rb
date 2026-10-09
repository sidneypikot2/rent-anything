module Trips
  # Deletes ended and long-idle trips (Trips::Cleanup). Daily, from config/recurring.yml.
  class CleanupJob < ApplicationJob
    queue_as :default

    def perform
      Trips::Cleanup.call
    end
  end
end
