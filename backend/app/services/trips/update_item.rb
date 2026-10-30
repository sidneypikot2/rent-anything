module Trips
  # Changes an item's dates, quantity, split into rooms or pets (RAA-182), a vehicle rental's
  # pickup time (RAA-195, null for the shop's default), or moves it to another of the guest's trips
  # (PATCH /trip_items/:id, RAA-64). Only the keys sent change; the trip it ends up in
  # grows to cover its dates. The trip it left keeps its dates.
  class UpdateItem < ApplicationService
    include Values

    def initialize(item, params)
      @item = item
      @params = params
      @errors = []
    end

    # The item is locked and read again first, so a concurrent move or re-date can't act
    # on stale dates or the wrong trip.
    def call
      Trip.transaction do
        @item.lock!
        error("A booked item can't be changed: cancel its booking first") if @item.booked?
        attributes = read_attributes
        move_to = integer_value(:move_to_trip_id, "Trip", required: true) if @params.key?(:move_to_trip_id)
        raise_errors!(@item)

        trip = move_to ? @item.trip.user.trips.find(move_to) : @item.trip
        Trip.lock_all(@item.trip, trip)
        moved_from = @item.trip
        # Moved out of the trip it was added to: the suggestion, if taken, was wrong.
        attributes[:followed_suggestion] = false if trip != @item.trip
        @item.assign_attributes(attributes.merge(trip:))
        trip.cover(@item.starts_on, @item.ends_on)
        trip.save!
        @item.save!
        # A move takes a place from one trip to another; a re-date can change their order.
        [ moved_from, trip ].uniq.each(&:follow_places_in_name!)
        trip
      end
    end

    private

    def read_attributes
      attributes = {}
      attributes[:starts_on], attributes[:ends_on] = read_dates("An item", [ @item.starts_on, @item.ends_on ]) if dates_sent?
      attributes[:quantity] = integer_value(:quantity, "Quantity", required: true) if @params.key?(:quantity)
      read_party(attributes) if @errors.empty?
      read_units(attributes) if @errors.empty?
      attributes[:pickup_time] = pickup_time_value(@item.listing) if @params.key?(:pickup_time)
      attributes.merge!(delivery_values(@item.listing, @item.slice(*DELIVERY_KEYS).symbolize_keys))
      read_child_helmets(attributes) if @errors.empty?
      attributes
    end

    # Child helmets sent are checked against the item's vehicles; fewer vehicles than the helmets
    # it has take the extra ones off (RAA-205).
    def read_child_helmets(attributes)
      helmets = @params.key?(:child_helmets) ? child_helmets_value(@item.listing) : @item.child_helmets
      return if helmets.nil?

      guests = attributes.fetch(:quantity, @item.quantity)
      units = Booking.units_for(@item.listing, guests, room_guests: attributes.fetch(:room_guests, @item.room_guests),
        chosen: attributes.fetch(:units, @item.units))
      if @params.key?(:child_helmets)
        check_child_helmets(helmets, units)
        attributes[:child_helmets] = helmets
      elsif helmets > units
        attributes[:child_helmets] = units
      end
    end

    # A vehicle's units (RAA-191): sent ones are checked against the guests; a new guest count
    # without them keeps the chosen units only while they still fit, otherwise derives them again.
    def read_units(attributes)
      guests = attributes.fetch(:quantity, @item.quantity)
      if @params.key?(:units)
        attributes[:units] = units_value
        check_vehicle_units(@item.listing, guests, attributes[:units]) if @errors.empty?
      elsif attributes.key?(:quantity)
        check_vehicle_units(@item.listing, guests, nil)
        seats = @item.listing.vehicle_seats
        attributes[:units] = nil if @item.units && seats && !@item.units.between?(guests.fdiv(seats).ceil, guests)
      end
    end

    # A new split into rooms sets the quantity; a new quantity without one drops the old
    # split, back to an even one (RAA-182).
    def read_party(attributes)
      if @params.key?(:room_guests)
        attributes[:room_guests] = room_guests_value
        quantity = guests_for(attributes[:room_guests], attributes[:quantity], sent: attributes.key?(:quantity))
        attributes[:quantity] = quantity if quantity
      elsif attributes.key?(:quantity)
        attributes[:room_guests] = nil
      end
      if @params.key?(:pets)
        attributes[:pets] = @params[:pets].nil? ? error("Pets is required") : count_value(:pets, "Pets", max: 20)
      end
      return unless %i[room_guests pets].any? { attributes.key?(_1) } && @errors.empty?

      check_stay_party(@item.listing, attributes.fetch(:quantity, @item.quantity),
        attributes.fetch(:room_guests, @item.room_guests), attributes.fetch(:pets, @item.pets))
    end
  end
end
