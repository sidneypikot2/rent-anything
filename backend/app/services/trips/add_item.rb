module Trips
  # Adds a listing to one of the guest's trips (POST /trip_items, RAA-64). Without a
  # trip_id it starts a new trip, named trip_name if the guest typed one, otherwise after the
  # destination and dates (decision 2) — a typed name then stays as typed — with
  # as many guests as the item's quantity. The trip's dates grow to cover the item, and
  # whether the guest took the suggested trip is kept for tuning the gap (decision 13).
  # Gear is booked by the count: its quantity is how many, `guests` (when sent) are a new
  # trip's, and gear the trip already holds unbooked for the same rental (dates, pickup and
  # delivery) takes the added count rather than a second item, so the cart has one line and
  # the partner one request.
  # A stay can come with the guest's split into rooms and pets (RAA-182); the split sets
  # its quantity. A vehicle rental can come with its pickup time (RAA-195).
  class AddItem < ApplicationService
    include Values

    HANDOVER_FIELDS = %i[delivery return_pickup delivery_address delivery_distance_m delivery_notes].freeze

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
        place(trip, item, followed_suggestion: suggested[:trip] == (trip_id && trip))
        trip.follow_places_in_name!
      end
      trip
    end

    # Puts an item read by `read` in the trip, a saved one locked by the caller: into the same
    # gear it already holds, or as an item of its own.
    def place(trip, item, followed_suggestion:)
      held_on_dates = held_gear(trip, item)
      check_gear_count(item, held_on_dates)
      same = held_on_dates.find { same_rental?(_1, item) }
      return same.update!(quantity: [ same.quantity + item[:quantity], TripItem::MAX_QUANTITY ].min) if same

      trip.items.create!(**item, followed_suggestion:)
    end

    # The trip's unbooked items of the same gear on the same dates.
    def held_gear(trip, item)
      return [] unless item[:listing].category.gear? && item[:starts_on]

      trip.items.unbooked.lock.where(listing: item[:listing], starts_on: item[:starts_on], ends_on: item[:ends_on]).to_a
    end

    # Whether an add is the rental an item already is: picked up at the same moment, no pickup
    # time being the shop's default, and handed over the same way.
    def same_rental?(held, item)
      listing = item[:listing]
      starts_at = ->(time) { listing.rental_period(item[:starts_on], item[:ends_on], time)&.begin }
      starts_at.(held.pickup_time) == starts_at.(item[:pickup_time]) &&
        HANDOVER_FIELDS.all? { held[_1].presence == item[_1].presence }
    end

    # Gear never goes past what the partner lists, counting what the trip already holds on those
    # dates: refused (422) rather than left for checkout to find.
    def check_gear_count(item, held)
      listing = item[:listing]
      return unless listing.category.gear?

      listed = listing.units.size
      holding = held.sum(&:quantity)
      return if holding + item[:quantity] <= listed

      error(holding.positive? ? "Only #{listed} of #{listing.title} are listed, and this trip already has #{holding} for these dates" :
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
