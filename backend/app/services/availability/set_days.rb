module Availability
  # A partner's change to a run of a listing's days (RAA-118), from starts_on to ends_on (at
  # most MAX_DAYS, none past): any of
  #
  # - price_cents, the day's price in centavos;
  # - units_available, how many of its units (a tour's groups) are on sale, from 0 to its
  #   capacity and never below what is already booked that day;
  # - min_nights, a stay's minimum nights from that check-in, 1 to 365.
  #
  # A key sent as null goes back to the listing's own; a key left out stays as it is. A day
  # with nothing of its own left has no row. Returns the run's first and last day.
  class SetDays < ApplicationService
    include Trips::Values

    MAX_DAYS = 366
    MAX_PRICE_CENTS = 1_000_000_000 # ₱10,000,000
    KEYS = %i[price_cents units_available min_nights].freeze

    def initialize(listing, params)
      @listing = listing
      @params = params
      @errors = []
    end

    def call
      from, to = read_range
      values = read_values
      raise_errors!(ListingDay.new)

      Listing.transaction do
        @listing.lock!
        check_bookings!(from, to, values[:units_available]) unless values[:units_available].nil?
        save!(from, to, values)
      end
      [ from, to ]
    end

    private

    def read_range
      from = required_date(:starts_on, "Start date")
      to = required_date(:ends_on, "End date")
      return [] unless from && to

      error("End date can't be before the start date") if to < from
      error("Change at most #{MAX_DAYS} days at a time") if (to - from).to_i >= MAX_DAYS
      error("Past days can't be changed") if from < Date.current
      [ from, to ]
    end

    def read_values
      keys = KEYS.select { @params.key?(_1) }
      error("Send a price, units on sale or a minimum stay to change") if keys.empty?
      keys.to_h { |key| [ key, @params[key].nil? ? nil : send(key) ] }
    end

    def price_cents
      value = @params[:price_cents]
      return value if value.is_a?(Integer) && value.between?(1, MAX_PRICE_CENTS)

      error("Price must be a whole number of centavos from 1 to #{MAX_PRICE_CENTS}")
    end

    def units_available
      value = @params[:units_available]
      capacity = Ledger.capacity(@listing)
      return value if value.is_a?(Integer) && value.between?(0, capacity)

      error("Units on sale must be a whole number from 0 to #{capacity}")
    end

    def min_nights
      return error("Only stays have a minimum stay") unless @listing.category.accommodation?

      value = @params[:min_nights]
      return value if value.is_a?(Integer) && value.between?(1, 365)

      error("Minimum stay must be a whole number of nights from 1 to 365")
    end

    def check_bookings!(from, to, units)
      ledger = Ledger.new([ @listing ], from, to)
      date = (from..to).find { ledger.booked(@listing, _1) > units }
      return unless date

      booked = ledger.booked(@listing, date)
      error("#{booked} #{'unit'.pluralize(booked)} #{booked == 1 ? 'is' : 'are'} already booked on " \
        "#{date.strftime('%b %-d')}: keep at least #{booked} on sale")
      raise_errors!(ListingDay.new)
    end

    def save!(from, to, values)
      days = @listing.days.where(date: from..to)
      if values.values.all?(&:nil?)
        # Only resets: a day keeping nothing of its own goes, the others drop these values.
        days.where((KEYS - values.keys).index_with(nil)).delete_all
        days.update_all(values.merge(updated_at: Time.current))
      else
        now = Time.current
        rows = (from..to).map { |date| { listing_id: @listing.id, date:, **values, created_at: now, updated_at: now } }
        ListingDay.upsert_all(rows, unique_by: %i[listing_id date], update_only: values.keys)
      end
    end
  end
end
