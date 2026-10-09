module Trips
  # Merges one trip into another of the same guest's (POST /trips/:id/merge, RAA-64): every
  # item moves to into_trip_id, whose dates grow to cover them, and the emptied trip is
  # deleted. Returns the trip merged into.
  class Merge < ApplicationService
    include Values

    def initialize(trip, params)
      @trip = trip
      @params = params
      @errors = []
    end

    def call
      into_id = integer_value(:into_trip_id, "Trip to merge into", required: true)
      error("A trip can't be merged into itself") if into_id == @trip.id
      raise_errors!(@trip)

      into = @trip.user.trips.find(into_id)
      Trip.transaction do
        Trip.lock_all(@trip, into)
        dated = @trip.items.where.not(starts_on: nil)
        into.cover(dated.minimum(:starts_on), dated.maximum(:ends_on))
        into.save!
        @trip.items.update_all(trip_id: into.id, updated_at: Time.current)
        @trip.destroy!
        into.touch
      end
      into
    end
  end
end
