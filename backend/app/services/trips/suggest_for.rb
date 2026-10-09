module Trips
  # Reads GET /trips/suggestion's query (listing_id, starts_on, ends_on) and runs Suggest.
  class SuggestFor < ApplicationService
    include Values

    def initialize(user, params)
      @user = user
      @params = params
      @errors = []
    end

    def call
      listing = find_listing(digits: true)
      starts_on, ends_on = read_dates("An item")
      raise_errors!(TripItem.new)

      Suggest.call(@user, listing:, starts_on:, ends_on:)
    end
  end
end
