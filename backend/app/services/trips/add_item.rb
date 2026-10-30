module Trips
  # Adds a listing to one of the guest's trips (POST /trip_items, RAA-64). Without a
  # trip_id it starts a new trip, named trip_name if the guest typed one, otherwise after the
  # destination and dates (decision 2) — a typed name then stays as typed — with
  # as many guests as the item's quantity. The trip's dates grow to cover the item, and
  # whether the guest took the suggested trip is kept for tuning the gap (decision 13).
  # Gear is booked by the count: its quantity is how many, `guests` (when sent) are a new
  # trip's, and gear the trip already holds unbooked on the same dates takes the added count
  # rather than a second item, so the cart has one line and the partner one request.
  # A stay can come with the guest's split into rooms and pets (RAA-182); the split sets
  # its quantity. A vehicle rental can come with its pickup time (RAA-195).
  class AddItem < ApplicationService
    include Values

    attr_reader :errors

    def initialize(user, params)
      @user = user
      @params = params
      @errors = []
    end

    def call
      item = read
      trip_id = integer_value(:trip_id, "Trip")
      typed_name = optional_string(@params, :trip_name, "Trip name") unless trip_id
      guests = count_value(:guests, "Guests", max: 50) unless trip_id
      error("Guests must be at least 1") if guests&.zero?
      raise_errors!(TripItem.new)

      trip = trip_id && @user.trips.find(trip_id)
      suggested = Suggest.call(@user, listing: item[:listing], starts_on: item[:starts_on], ends_on: item[:ends_on])
      Trip.transaction do
        trip&.lock!
        trip ||= @user.trips.build(name: typed_name || suggested[:new_trip_name], guests: guests || item[:quantity].clamp(1, 50))
        trip.cover(item[:starts_on], item[:ends_on])
        trip.save!
        held = held_gear(trip, item)
        check_gear_count(item, held)
        if held
          held.update!(quantity: [ held.quantity + item[:quantity], TripItem::MAX_QUANTITY ].min)
        else
          trip.items.create!(**item, followed_suggestion: suggested[:trip] == (trip_id && trip))
        end
        trip.follow_places_in_name!
      end
      trip
    end

    # The trip's unbooked item of the same gear on the same dates, which an add counts into.
    def held_gear(trip, item)
      return unless item[:listing].category.gear? && trip.persisted? && item[:starts_on]

      trip.items.unbooked.lock.find_by(listing: item[:listing], starts_on: item[:starts_on], ends_on: item[:ends_on])
    end

    # Gear never goes past what the partner lists, counting what the trip already holds on those
    # dates: refused (422) rather than left for checkout to find.
    def check_gear_count(item, held)
      listing = item[:listing]
      return unless listing.category.gear?

      listed = listing.units.size
      return if (held&.quantity || 0) + item[:quantity] <= listed

      error(held ? "Only #{listed} of #{listing.title} are listed, and this trip already has #{held.quantity} for these dates" :
        "Only #{listed} of #{listing.title} are listed")
      raise_errors!(TripItem.new)
    end

    # The item's own fields, read and checked; the reasons it's refused are in `errors`.
    # AddItems reads each of several items with it.
    def read
      listing = find_listing
      starts_on, ends_on = read_dates("An item")
      quantity = @params.key?(:quantity) ? integer_value(:quantity, "Quantity", required: true) : 1
      room_guests = room_guests_value
      pets = count_value(:pets, "Pets", max: 20) || 0
      units = units_value
      pickup_time = pickup_time_value(listing) if listing
      delivery = listing ? delivery_values(listing) : {}
      child_helmets = (child_helmets_value(listing) if listing) || 0
      quantity = guests_for(room_guests, quantity, sent: @params.key?(:quantity))
      check_stay_party(listing, quantity, room_guests, pets) if listing && @errors.empty?
      check_vehicle_units(listing, quantity, units) if listing && @errors.empty?
      if listing && child_helmets.positive? && @errors.empty?
        check_child_helmets(child_helmets, Booking.units_for(listing, quantity, room_guests:, chosen: units))
      end
      { listing:, starts_on:, ends_on:, quantity:, room_guests:, pets:, units:, pickup_time:, child_helmets:, **delivery }
    end
  end
end
