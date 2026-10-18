module Bookings
  # Expires unanswered requests and unpaid holds (Bookings::Expire). Every 5 minutes, from
  # config/recurring.yml.
  class ExpireJob < ApplicationJob
    queue_as :default

    def perform
      Bookings::Expire.call
    end
  end
end
