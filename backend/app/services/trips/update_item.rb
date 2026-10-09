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

    def call
      attributes = {}
      attributes[:starts_on], attributes[:ends_on] = read_dates("An item", [ @item.starts_on, @item.ends_on ]) if dates_sent?
      attributes[:quantity] = integer_value(:quantity, "Quantity", required: true) if @params.key?(:quantity)
      move_to = integer_value(:move_to_trip_id, "Trip", required: true) if @params.key?(:move_to_trip_id)
      raise_errors!(@item)

      trip = move_to ? @item.trip.user.trips.find(move_to) : @item.trip
      Trip.transaction do
        Trip.lock_all(@item.trip, trip)
        @item.assign_attributes(attributes.merge(trip:))
        trip.cover(@item.starts_on, @item.ends_on)
        trip.save!
        @item.save!
      end
      trip
    end

    private

    def dates_sent?
      @params.key?(:starts_on) || @params.key?(:ends_on)
    end
  end
end
