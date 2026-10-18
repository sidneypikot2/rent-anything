module Trips
  # Deletes the trips whose deletion date (Trip#deletes_on) has come, with their items
  # (RAA-65). The cart has shown each one's deletion notice for the 7 days before. Run daily
  # by Trips::CleanupJob. A trip with booked items (RAA-132) keeps them and stays; only its
  # unbooked items go. Returns how many trips it deleted.
  class Cleanup < ApplicationService
    def call
      today = Date.current
      Trip.due_for_cleanup.find_each.count do |trip|
        Trip.transaction do
          # The guest may have deleted the trip since the query, or edited it, which resets
          # an undated trip's clock.
          trip = Trip.lock.find_by(id: trip.id)
          next false unless trip&.deletes_on(today)&.<=(today)

          trip.items.unbooked.delete_all
          trip.booked? ? false : trip.destroy!
        end
      end
    end
  end
end
