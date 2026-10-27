module Trips
  # A guest plans a named trip (POST /trips), or changes a trip's name, dates or guests
  # (PATCH /trips/:id; only the keys sent change, and null dates make it undated). Of the
  # guests, children and infants are counted apart, and pets beside them (RAA-182).
  #
  # Its unbooked items follow the change: one that spanned the whole trip takes the new dates,
  # one the new dates no longer reach becomes undated (kept, to be dated again), and one for
  # the whole group takes the new guests, split evenly again. Whether the listing can still have them is the
  # item's `unavailable` (TripSerializer). A booked item stays as it is, so dates leaving it
  # outside are refused by Trip.
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
      { children: "Children", infants: "Infants", pets: "Pets" }.each do |key, label|
        attributes[key] = integer_value(key, label, required: true) if @params.key?(key)
      end
      raise_errors!(@trip)

      Trip.transaction do
        if @trip.persisted?
          @trip.lock!
          follow(attributes)
        end
        @trip.update!(attributes)
      end
      @trip
    end

    private

    def follow(attributes)
      from, to = attributes.values_at(:starts_on, :ends_on)
      redated = attributes.key?(:starts_on) && [ from, to ] != [ @trip.starts_on, @trip.ends_on ]
      guests = attributes[:guests] if attributes.key?(:guests) && attributes[:guests] != @trip.guests
      return unless redated || guests

      @trip.items.unbooked.each do |item|
        item.assign_attributes(quantity: guests, room_guests: nil) if guests && item.quantity == @trip.guests
        item.starts_on, item.ends_on = redate(item, from, to) if redated && item.starts_on
        item.save! if item.changed?
      end
    end

    # An item's dates once the trip's are from..to.
    def redate(item, from, to)
      return [ from, to ] if from && [ item.starts_on, item.ends_on ] == [ @trip.starts_on, @trip.ends_on ]
      return [ nil, nil ] if from.nil? || item.starts_on < from || item.ends_on > to

      [ item.starts_on, item.ends_on ]
    end
  end
end
