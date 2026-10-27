module Trips
  # Adds several listings to one of the guest's trips at once (POST /trip_items with `items`,
  # RAA-187): a mix of a business's room types from GET /stay_mixes. Each item is read and
  # checked as AddItem reads one, its refusals prefixed with its place in the list, and all
  # are added or none. Without a trip_id a new trip is named after the first item's
  # suggestion (or trip_name), for the guests of every item together.
  class AddItems < ApplicationService
    include Values

    MAX_ITEMS = 10
    ITEM_KEYS = %i[listing_id starts_on ends_on quantity room_guests pets].freeze

    def initialize(user, params)
      @user = user
      @params = params
      @errors = []
    end

    def call
      items = read_items
      trip_id = integer_value(:trip_id, "Trip")
      typed_name = optional_string(@params, :trip_name, "Trip name") unless trip_id
      raise_errors!(TripItem.new)

      trip = trip_id && @user.trips.find(trip_id)
      suggestions = items.map { Suggest.call(@user, listing: _1[:listing], starts_on: _1[:starts_on], ends_on: _1[:ends_on]) }
      Trip.transaction do
        trip&.lock!
        trip ||= @user.trips.build(name: typed_name || suggestions.first[:new_trip_name],
          guests: items.sum { _1[:quantity] }.clamp(1, 50))
        items.each { trip.cover(_1[:starts_on], _1[:ends_on]) }
        trip.save!
        items.zip(suggestions).each do |item, suggested|
          trip.items.create!(**item, followed_suggestion: suggested[:trip] == (trip_id && trip))
        end
        trip.follow_places_in_name!
      end
      trip
    end

    private

    def read_items
      return error("Send items or one item's fields, not both") || [] if ITEM_KEYS.any? { @params.key?(_1) }

      items = @params[:items]
      unless items.is_a?(Array) && items.size.between?(1, MAX_ITEMS) && items.all? { _1.respond_to?(:key?) }
        return error("Items must be a list of 1 to #{MAX_ITEMS} items") || []
      end

      items.each_with_index.map do |params, index|
        reader = AddItem.new(@user, params)
        item = reader.read
        reader.errors.each { error("Item #{index + 1}: #{_1}") }
        item
      end
    end
  end
end
