module Trips
  # Adds a listing to one of the guest's trips (POST /trip_items, RAA-64). Without a
  # trip_id it starts a new trip, named trip_name if the guest typed one, otherwise after the
  # destination and dates (decision 2) — a typed name then stays as typed — with
  # as many guests as the item's quantity. The trip's dates grow to cover the item, and
  # whether the guest took the suggested trip is kept for tuning the gap (decision 13).
  # A stay can come with the guest's split into rooms and pets (RAA-182); the split sets
  # its quantity.
  class AddItem < ApplicationService
    include Values

    def initialize(user, params)
      @user = user
      @params = params
      @errors = []
    end

    def call
      listing = find_listing
      starts_on, ends_on = read_dates("An item")
      quantity = @params.key?(:quantity) ? integer_value(:quantity, "Quantity", required: true) : 1
      room_guests = room_guests_value
      pets = count_value(:pets, "Pets", max: 20) || 0
      quantity = guests_for(room_guests, quantity, sent: @params.key?(:quantity))
      check_stay_party(listing, quantity, room_guests, pets) if listing && @errors.empty?
      trip_id = integer_value(:trip_id, "Trip")
      typed_name = optional_string(@params, :trip_name, "Trip name") unless trip_id
      raise_errors!(TripItem.new)

      trip = trip_id && @user.trips.find(trip_id)
      suggested = Suggest.call(@user, listing:, starts_on:, ends_on:)
      Trip.transaction do
        trip&.lock!
        trip ||= @user.trips.build(name: typed_name || suggested[:new_trip_name], guests: quantity.clamp(1, 50))
        trip.cover(starts_on, ends_on)
        trip.save!
        trip.items.create!(listing:, starts_on:, ends_on:, quantity:, room_guests:, pets:,
          followed_suggestion: suggested[:trip] == (trip_id && trip))
        trip.follow_places_in_name!
      end
      trip
    end
  end
end
