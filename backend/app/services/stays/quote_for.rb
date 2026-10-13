module Stays
  # Reads GET /quotes's query (listing_id, starts_on, ends_on, guests, fee_ids[]) and runs
  # Quote (RAA-104). A query string carries everything as text, so the ids and guests may be
  # strings of digits; the dates are ISO 8601, as on a trip.
  class QuoteFor < ApplicationService
    include Trips::Values

    def initialize(params)
      @params = params
      @errors = []
    end

    def call
      listing = find_listing(digits: true)
      starts_on = required_date(:starts_on, "Check-in")
      ends_on = required_date(:ends_on, "Check-out")
      guests = integer_value(:guests, "Guests", required: true, digits: true)
      fee_ids = read_fee_ids
      raise_errors!(StayRate.new)

      Quote.call(Listing.includes(:category, :stay_rate, :fees).find(listing.id), starts_on:, ends_on:, guests:, fee_ids:)
    end

    private

    def required_date(key, label)
      return error("#{label} is required") if @params[key].blank?

      date_value(key, label)
    end

    def read_fee_ids
      ids = @params[:fee_ids]
      return [] if ids.nil?
      return ids.map { |id| Integer(id, 10) } if ids.is_a?(Array) && ids.all? { _1.is_a?(String) && _1.match?(/\A\d+\z/) }

      error("Add-ons must be a list of fee ids") || []
    end
  end
end
