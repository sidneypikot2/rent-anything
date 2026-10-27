module Stays
  # Reads GET /stay_mixes's query (listing_ids[], starts_on, ends_on, adults, children,
  # infants, pets) and runs Mixes (RAA-187). As in QuoteFor, ids and counts come as strings
  # of digits and the dates are ISO 8601. The listings are 2 to MAX_LISTINGS active stays of
  # one business: its room types.
  class MixesFor < ApplicationService
    include Trips::Values

    MAX_LISTINGS = 10

    # A query parameter sent empty counts as not sent.
    def initialize(params)
      @params = params.compact_blank
      @errors = []
    end

    def call
      listings = read_listings
      starts_on = required_date(:starts_on, "Check-in")
      ends_on = required_date(:ends_on, "Check-out")
      check_dates(starts_on, ends_on) if starts_on && ends_on
      party = read_party
      raise_errors!(StayRate.new)

      Mixes.call(listings, starts_on:, ends_on:, **party)
    end

    private

    def read_listings
      ids = @params[:listing_ids]
      unless ids.is_a?(Array) && ids.all? { _1.is_a?(String) && _1.match?(/\A\d+\z/) }
        return error("Room types must be a list of listing ids")
      end

      ids = ids.map { Integer(_1, 10) }.uniq
      return error("Pick 2 to #{MAX_LISTINGS} room types") unless ids.size.between?(2, MAX_LISTINGS)

      listings = Listing.active.where(id: ids).includes(:category, :units, :stay_rate, :tour_detail, :fees)
        .sort_by { ids.index(_1.id) }
      one_business = listings.size == ids.size && listings.map(&:business_id).uniq.one? &&
        listings.all? { _1.category.accommodation? && _1.stay_rate }
      one_business ? listings : error("The room types must be active stays of one business")
    end

    def check_dates(starts_on, ends_on)
      return error("Check-out must be after check-in") unless ends_on > starts_on

      error("Check-in can't be in the past") if starts_on < Date.current
    end

    def read_party
      party = {
        adults: count_value(:adults, "Adults", max: 99, digits: true),
        children: count_value(:children, "Children", max: 99, digits: true) || 0,
        infants: count_value(:infants, "Infants", max: 99, digits: true) || 0,
        pets: count_value(:pets, "Pets", max: 20, digits: true) || 0
      }
      if party[:adults].nil? && !@params.key?(:adults)
        error("Adults is required")
      elsif party[:adults]&.zero?
        error("A stay needs an adult")
      end
      party
    end
  end
end
