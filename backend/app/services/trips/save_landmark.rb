module Trips
  # A guest saves a place to see to one of their trips (POST /trip_landmarks). Without a
  # trip_id it starts a new trip, undated, named trip_name if the guest typed one, otherwise
  # after the place's destination, for `guests` (1 when not sent), as an add to a new trip
  # does. Saving a place the trip already has is not an error: the trip comes back as it is.
  # Only a published place can be saved.
  class SaveLandmark < ApplicationService
    include Values

    def initialize(user, params)
      @user = user
      @params = params
      @errors = []
    end

    def call
      slug = required_string(@params, :landmark_slug, "Place to see")
      trip_id = integer_value(:trip_id, "Trip")
      typed_name = optional_string(@params, :trip_name, "Trip name") unless trip_id
      guests = count_value(:guests, "Guests", max: 50) unless trip_id
      error("Guests must be at least 1") if guests&.zero?
      raise_errors!(TripLandmark.new)

      landmark = Landmark.published.find_by!(slug:)
      trip = trip_id && @user.trips.find(trip_id)
      Trip.transaction do
        trip&.lock!
        trip ||= @user.trips.create!(name: typed_name || Destination.trip_name(landmark.area, nil, nil), guests: guests || 1)
        trip.saved_landmarks.find_or_create_by!(landmark:)
      end
      trip
    end
  end
end
