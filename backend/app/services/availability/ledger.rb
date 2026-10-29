module Availability
  # What a partner's calendar holds for some listings over some days (RAA-118), read in one
  # query per table: each day's price, units on sale, units booked and left, minimum stay and
  # block. Preload each listing's category, units, stay_rate and tour_detail. Every booking that
  # holds its days counts as booked (Booking::HOLDING, RAA-132): a request and an unpaid hold
  # take them as a confirmed booking does, so nothing is sold twice while they wait.
  #
  # - Capacity is a joiner tour's seats a day (its groups filled to max_guests, RAA-119), a
  #   private tour's groups a day, otherwise its units; a day's units_available can lower it,
  #   never raise it.
  # - The price is the day's own, else a stay's nightly price (its weekend one on Friday and
  #   Saturday nights) or a tour's base price; null while the listing has none (rentals and
  #   transfers aren't priced yet).
  # - A stay's minimum nights apply to stays checking in that day.
  #
  # - A vehicle rental (RAA-195) counts on the days it starts, as a stay counts its nights, so
  #   its vehicles show free again on the day they come back. `refusal` with its `period` also
  #   checks it by the hour: at no moment of it, nor of the turnaround after it, may the
  #   bookings out at once and `quantity` together be more than the units. Bookings take units
  #   by count, not particular vehicles, and that is enough: rentals that never need more
  #   vehicles at once than there are can always be handed out one vehicle each.
  #
  # `except` leaves one booking out, for a booking being changed (Bookings::Change): its own
  # days are free to it.
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

    def initialize(listings, from, to, except: nil)
      @from = from
      @to = to
      @except = except
      @rentals = {}
      @listings = listings.index_by(&:id)
      ids = @listings.keys
      @days = ListingDay.where(listing_id: ids, date: from..to).index_by { [ _1.listing_id, _1.date ] }
      @blocks = AvailabilityBlock.where(listing_id: ids).overlapping(from, to).order(:starts_on).group_by(&:listing_id)
      bookings = Booking.holding.where(listing_id: ids).overlapping(from, to)
      bookings = bookings.where.not(id: except.id) if except
      @bookings = bookings.order(:starts_on, :id).group_by(&:listing_id)
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

    # Why `quantity` units can't be had on each of the dates, or nil when they can. A vehicle
    # rental's `period` (Booking.rental_period) is checked by the hour as well.
    def refusal(listing, dates, quantity, period: nil)
      dates.each do |date|
        day = day(listing, date)
        on = date.strftime("%b %-d")
        return "#{on} is blocked" if day[:block_id]
        next if day[:units_left] >= quantity

        return day[:units_left].zero? ? "#{on} is fully booked" : "Only #{day[:units_left]} left on #{on}"
      end
      period && listing.category.vehicle? ? rental_refusal(listing, period, quantity) : nil
    end

    # The units free on every one of the dates (RAA-191): the fewest left on any of them. A
    # vehicle rental's `period` (RAA-195) also counts by the hour: the units, less the most out
    # at once from pickup to return and the turnaround after it.
    def units_free(listing, dates, period: nil)
      free = dates.map { day(listing, _1)[:units_left] }.min
      return free unless free && period && listing.category.vehicle?

      load = 0
      peak = rental_out(listing, period).last.map { load += _2 }.max || 0
      [ [ free, self.class.capacity(listing) - peak ].min, 0 ].max
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

    # The vehicles out at once over the period and its turnaround, swept in time order (a
    # return and a pickup at the same moment don't overlap). When too few are free at the
    # pickup, says when enough are back; when a later rental takes them, from when.
    def rental_refusal(listing, period, quantity)
      return "That pickup time has passed" if period.begin < Time.current

      capacity = self.class.capacity(listing)
      turnaround = turnaround(listing)
      out, events = rental_out(listing, period)
      load = 0
      events.each do |at, change|
        load += change
        next if load + quantity <= capacity

        return at == period.begin ? free_from(out, period, quantity, capacity, turnaround) : "Booked from #{moment(at)}"
      end
      nil
    end

    def turnaround(listing) = (listing.vehicle_rate&.turnaround_minutes || 0).minutes

    # The listing's rentals out during the period and the turnaround after it, each clipped to
    # it, and the moments the vehicles out change, in time order (a return and a pickup at the
    # same moment don't overlap).
    def rental_out(listing, period)
      turnaround = turnaround(listing)
      ends = period.end + turnaround
      out = rental_bookings(listing).filter_map do |booking|
        from = [ booking.starts_at, period.begin ].max
        to = [ booking.ends_at + turnaround, ends ].min
        [ from, to, booking ] if from < to
      end
      [ out, out.flat_map { |from, to, booking| [ [ from, booking.quantity ], [ to, -booking.quantity ] ] }.sort ]
    end

    # When enough of the vehicles out at the pickup are back for `quantity` of them.
    def free_from(out, period, quantity, capacity, turnaround)
      at_pickup = out.select { |from, _, _| from == period.begin }.map(&:last).sort_by(&:ends_at)
      short = at_pickup.sum(&:quantity) + quantity - capacity
      back = at_pickup.find { (short -= _1.quantity) <= 0 }
      ready = back && back.ends_at + turnaround
      on = period.begin.in_time_zone(Booking::RENTAL_TIME_ZONE).strftime("%b %-d")
      ready && ready.in_time_zone(Booking::RENTAL_TIME_ZONE).to_date == period.begin.in_time_zone(Booking::RENTAL_TIME_ZONE).to_date ?
        "Available from #{moment(ready)}" : "#{on} is fully booked"
    end

    def moment(time)
      time.in_time_zone(Booking::RENTAL_TIME_ZONE).strftime("%-l:%M %p on %b %-d")
    end

    # The listing's rentals that may touch a period from the window's dates, loaded once.
    def rental_bookings(listing)
      @rentals[listing.id] ||= begin
        zone = ActiveSupport::TimeZone[Booking::RENTAL_TIME_ZONE]
        from = zone.local(@from.year, @from.month, @from.day) - 2.days
        to = zone.local(@to.year, @to.month, @to.day) + 3.days
        bookings = Booking.holding.where(listing_id: listing.id).where(starts_at: ...to).where("ends_at > ?", from)
        bookings = bookings.where.not(id: @except.id) if @except
        bookings.to_a
      end
    end

    def count(booking, from, to)
      listing = @listings[booking.listing_id]
      Booking.days_for(listing, booking.starts_on, booking.ends_on).each do |date|
        @booked[[ listing.id, date ]] += booking.quantity if date.between?(from, to)
      end
    end
  end
end
