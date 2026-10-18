module Bookings
  # Starts and completes bookings by their dates (Bookings::Progress). Daily, from
  # config/recurring.yml.
  class ProgressJob < ApplicationJob
    queue_as :default

    def perform
      Bookings::Progress.call
    end
  end
end
