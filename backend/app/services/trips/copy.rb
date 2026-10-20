module Trips
  # A guest plans a trip again (POST /trips/:id/copy, RAA-139): a new trip with the same items,
  # each moved by as many days as the new start date is from the old one, nothing booked.
  # `starts_on` is required for a dated trip; `name` defaults to "<name> again" and `guests` to
  # the trip's. An item whose listing can't be booked any more is left out. Returns the new
  # trip and the items skipped ({ listing_id, title, reason }).
  class Copy < ApplicationService
    include Values

    SKIPPED_REASON = "Isn't available to book any more".freeze

    def initialize(trip, params)
      @source = trip
      @params = params
      @errors = []
    end

    def call
      trip = @source.user.trips.build
      starts_on = @source.dated? ? required_date(:starts_on, "Start date") : nil
      name = @params.key?(:name) ? required_string(@params, :name, "Name") : default_name
      guests = @params.key?(:guests) ? integer_value(:guests, "Guests", required: true) : @source.guests
      raise_errors!(trip)

      shift = starts_on && (starts_on - @source.starts_on)
      items, gone = @source.items.includes(:listing).partition { _1.listing.active? }
      Trip.transaction do
        trip.update!(name:, guests:, starts_on:, ends_on: shift && @source.ends_on + shift)
        items.each do |item|
          trip.items.create!(listing: item.listing, quantity: item.quantity,
            starts_on: item.starts_on && item.starts_on + shift, ends_on: item.ends_on && item.ends_on + shift)
        end
      end
      { trip:, skipped: gone.map { { listing_id: _1.listing_id, title: _1.listing.title, reason: SKIPPED_REASON } } }
    end

    private

    def default_name
      "#{@source.name.first(74)} again"
    end
  end
end
