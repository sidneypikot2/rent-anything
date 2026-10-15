module Availability
  # What a partner's calendar holds for some listings over some days (RAA-118), read in one
  # query per table: each day's price, units on sale, units booked and left, minimum stay and
  # block. Preload each listing's category, units, stay_rate and tour_detail.
  #
  # - Capacity is a joiner tour's seats a day (its groups filled to max_guests, RAA-119), a
  #   private tour's groups a day, otherwise its units; a day's units_available can lower it,
  #   never raise it.
  # - The price is the day's own, else a stay's nightly price (its weekend one on Friday and
  #   Saturday nights) or a tour's base price; null while the listing has none (rentals and
  #   transfers aren't priced yet).
  # - A stay's minimum nights apply to stays checking in that day.
  class Ledger
    def self.capacity(listing)
      return listing.units.size unless listing.category.tour?

      tour = listing.tour_detail
      return 0 unless tour

      tour.joiner? ? tour.max_guests * tour.max_groups_per_day : tour.max_groups_per_day
    end

    # What capacity counts: a joiner tour's seats, a private tour's groups, otherwise units.
    def self.capacity_unit(listing)
      return "units" unless listing.category.tour?

      listing.tour_detail&.joiner? ? "seats" : "groups"
    end

    def initialize(listings, from, to)
      @listings = listings.index_by(&:id)
      ids = @listings.keys
      @days = ListingDay.where(listing_id: ids, date: from..to).index_by { [ _1.listing_id, _1.date ] }
      @blocks = AvailabilityBlock.where(listing_id: ids).overlapping(from, to).order(:starts_on).group_by(&:listing_id)
      @bookings = Booking.confirmed.where(listing_id: ids).overlapping(from, to).order(:starts_on, :id)
        .group_by(&:listing_id)
      @booked = Hash.new(0)
      @bookings.each_value { |bookings| bookings.each { count(_1, from, to) } }
    end

    def blocks(listing) = @blocks.fetch(listing.id, [])
    def bookings(listing) = @bookings.fetch(listing.id, [])
    def booked(listing, date) = @booked[[ listing.id, date ]]

    def day(listing, date)
      own = @days[[ listing.id, date ]]
      capacity = self.class.capacity(listing)
      units = own&.units_available ? [ own.units_available, capacity ].min : capacity
      booked = booked(listing, date)
      block = blocks(listing).find { _1.covers?(date) }
      {
        date:,
        price_cents: own&.price_cents || base_price_cents(listing, date),
        price_set: !own&.price_cents.nil?,
        units_available: units,
        units_set: !own&.units_available.nil?,
        booked:,
        units_left: block ? 0 : [ units - booked, 0 ].max,
        min_nights: own&.min_nights || default_min_nights(listing),
        min_nights_set: !own&.min_nights.nil?,
        block_id: block&.id
      }
    end

    # Why `quantity` units can't be had on each of the dates, or nil when they can.
    def refusal(listing, dates, quantity)
      dates.each do |date|
        day = day(listing, date)
        on = date.strftime("%b %-d")
        return "#{on} is blocked" if day[:block_id]
        next if day[:units_left] >= quantity

        return day[:units_left].zero? ? "#{on} is fully booked" : "Only #{day[:units_left]} left on #{on}"
      end
      nil
    end

    def default_min_nights(listing)
      listing.category.accommodation? ? listing.stay_rate&.min_nights : nil
    end

    def base_price_cents(listing, date)
      if (rate = listing.stay_rate)
        return nil unless rate.priced?

        weekend = StayRate::WEEKEND_DAYS.include?(date.wday)
        weekend && rate.weekend_price_cents ? rate.weekend_price_cents : rate.nightly_price_cents
      elsif (tour = listing.tour_detail)
        tour.priced? ? tour.base_price_cents : nil
      end
    end

    private

    def count(booking, from, to)
      listing = @listings[booking.listing_id]
      Booking.days_for(listing.category.accommodation?, booking.starts_on, booking.ends_on).each do |date|
        @booked[[ listing.id, date ]] += booking.quantity if date.between?(from, to)
      end
    end
  end
end
