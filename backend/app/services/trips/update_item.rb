module Trips
  # Changes an item's dates or quantity, or moves it to another of the guest's trips
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
        attributes = read_attributes
        move_to = integer_value(:move_to_trip_id, "Trip", required: true) if @params.key?(:move_to_trip_id)
        raise_errors!(@item)

        trip = move_to ? @item.trip.user.trips.find(move_to) : @item.trip
        Trip.lock_all(@item.trip, trip)
        # Moved out of the trip it was added to: the suggestion, if taken, was wrong.
        attributes[:followed_suggestion] = false if trip != @item.trip
        @item.assign_attributes(attributes.merge(trip:))
        trip.cover(@item.starts_on, @item.ends_on)
        trip.save!
        @item.save!
        trip
      end
    end

    private

    def read_attributes
      attributes = {}
      attributes[:starts_on], attributes[:ends_on] = read_dates("An item", [ @item.starts_on, @item.ends_on ]) if dates_sent?
      attributes[:quantity] = integer_value(:quantity, "Quantity", required: true) if @params.key?(:quantity)
      attributes
    end
  end
end
