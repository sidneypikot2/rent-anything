module Availability
  # A listing's units free day by day (RAA-315), for the booking card's calendar: it shows each
  # day's count and greys out those with none, so a guest can't pick dates the listing can't cover
  # rather than being told afterwards. As the partner's calendar counts them (Ledger#day); a vehicle
  # or gear rental has none today once the shop's last pickup has gone. `from` to `to`, both
  # included, at most MAX_DAYS, from today on.
  class Days < ApplicationService
    include Trips::Values

    MAX_DAYS = 92

    def initialize(listing_id, params)
      @listing_id = listing_id
      @params = params
      @errors = []
    end

    def call
      listing = Listing.active.find(@listing_id)
      from = required_date(:from, "From")
      to = required_date(:to, "To")
      check_range(from, to) if from && to
      raise_errors!(listing)

      ledger = Ledger.new([ listing ], from, to)
      rate = listing.category.timed_rental? ? listing.vehicle_rate : nil
      days = (from..to).map do |date|
        gone = rate && rate.pickup_times_on(date).empty?
        { date:, units_free: gone ? 0 : ledger.day(listing, date)[:units_left] }
      end
      { days: }
    end

    private

    def check_range(from, to)
      return error("From can't be in the past") if from < Date.current
      return error("To can't be before from") if to < from

      error("Ask for at most #{MAX_DAYS} days at a time") if (to - from).to_i >= MAX_DAYS
    end
  end
end
