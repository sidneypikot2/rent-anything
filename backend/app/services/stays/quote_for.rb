module Stays
  # Reads GET /quotes's query (listing_id, starts_on, ends_on, guests, fee_ids[]) and runs
  # Quote (RAA-104). A query string carries everything as text, so the ids and guests may be
  # strings of digits; the dates are ISO 8601, as on a trip. The party (RAA-182) is adults,
  # children, infants and pets, with room_guests as JSON text; `guests` alone still means
  # that many adults.
  class QuoteFor < ApplicationService
    include Trips::Values

    # A query parameter sent empty counts as not sent.
    def initialize(params)
      @params = params.compact_blank
      @errors = []
    end

    def call
      listing = find_listing(digits: true)
      starts_on = required_date(:starts_on, "Check-in")
      ends_on = required_date(:ends_on, "Check-out")
      party = read_party
      fee_ids = read_fee_ids
      raise_errors!(StayRate.new)

      Quote.call(Listing.includes(:category, :units, :stay_rate, :tour_detail, :fees).find(listing.id), starts_on:, ends_on:,
        **party, fee_ids:)
    end

    private

    def read_party
      adults = @params.key?(:adults) ? :adults : :guests
      {
        adults: integer_value(adults, adults.to_s.humanize, required: true, digits: true),
        children: count_value(:children, "Children", max: 99, digits: true) || 0,
        infants: count_value(:infants, "Infants", max: 99, digits: true) || 0,
        pets: count_value(:pets, "Pets", max: 20, digits: true) || 0,
        room_guests: room_guests_value(json: true)
      }
    end

    def read_fee_ids
      ids = @params[:fee_ids]
      return [] if ids.nil?
      return ids.map { |id| Integer(id, 10) } if ids.is_a?(Array) && ids.all? { _1.is_a?(String) && _1.match?(/\A\d+\z/) }

      error("Add-ons must be a list of fee ids") || []
    end
  end
end
