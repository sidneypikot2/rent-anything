module Trips
  # A guest plans a named trip (POST /trips), or changes a trip's name, dates or guests
  # (PATCH /trips/:id; only the keys sent change, and null dates make it undated). Shrinking
  # the dates so they no longer cover an item is refused by Trip.
  class Save < ApplicationService
    include Values

    def initialize(trip, params)
      @trip = trip
      @params = params
      @errors = []
    end

    def call
      attributes = {}
      attributes[:name] = required_string(@params, :name, "Name") if @trip.new_record? || @params.key?(:name)
      attributes[:starts_on], attributes[:ends_on] = read_dates("A trip", [ @trip.starts_on, @trip.ends_on ]) if dates_sent?
      attributes[:guests] = integer_value(:guests, "Guests", required: true) if @params.key?(:guests)
      raise_errors!(@trip)

      Trip.transaction do
        @trip.lock! if @trip.persisted?
        @trip.update!(attributes)
      end
      @trip
    end
  end
end
