module Discovery
  # The listings with a unit free on the dates a guest picked on What to book (2026-11-11), for
  # its cards (BookCards) and its map (MapPins): a stay's and a vehicle rental's nights from
  # `from` to the day before `to` (they count the days they start), anything else every day of it.
  #
  # A listing nothing holds on the dates — no day of its own (price, units, minimum stay), no
  # block, no booking — has its whole capacity left on each of them (Availability::Ledger#day), so
  # it is free when it has any: that part is SQL. Only the listings something holds go through the
  # Ledger, so a place with thousands of listings and a few bookings reads a few, not all.
  module FreeListings
    # The longest stretch of dates, which bounds the availability read.
    MAX_DAYS = 365

    # The listings something holds on the dates: a day of their own (price, units, minimum stay),
    # a block or a booking. One set for the query (a hashed subplan), not three lookups per listing,
    # which at 50,000 listings in a place cost more than the cards themselves (2026-11-12).
    HELD = <<~SQL.squish.freeze
      listings.id IN (SELECT listing_days.listing_id FROM listing_days WHERE listing_days.date BETWEEN :from AND :to
        UNION ALL SELECT availability_blocks.listing_id FROM availability_blocks
          WHERE availability_blocks.starts_on <= :to AND availability_blocks.ends_on >= :from
        UNION ALL SELECT bookings.listing_id FROM bookings WHERE bookings.status IN (:holding)
          AND bookings.starts_on <= :to AND bookings.ends_on >= :from)
    SQL
    # Ledger.capacity in SQL (keep the two in step): a tour's seats or groups a day, otherwise its
    # units. An OR rather than a CASE, so Postgres checks the units as one join, not listing by listing.
    TOUR = <<~SQL.squish.freeze
      listings.category_id IN (SELECT categories.id FROM categories
        WHERE categories.slug = 'tour' AND categories.booking_type = 'activity')
    SQL
    HAS_CAPACITY = <<~SQL.squish.freeze
      (#{TOUR} AND COALESCE((SELECT CASE WHEN tour_details.tour_type = 'joiner'
          THEN tour_details.max_guests * tour_details.max_groups_per_day
          ELSE tour_details.max_groups_per_day END FROM tour_details WHERE tour_details.listing_id = listings.id), 0) > 0)
      OR (NOT (#{TOUR}) AND EXISTS (SELECT 1 FROM listing_units WHERE listing_units.listing_id = listings.id))
    SQL

    # The request's dates: both or neither, from today on, `to` not before `from`, at most
    # MAX_DAYS apart. [from, to] as Dates, or nil (with a message in `errors` when they are wrong).
    def self.read_dates(from, to, errors)
      from, to = [ from, to ].map { |value| value.presence && (Date.iso8601(value.to_s) rescue :invalid) }
      return if from.nil? && to.nil?

      problem =
        if !from.is_a?(Date) || !to.is_a?(Date) then "From and to must both be dates (YYYY-MM-DD)"
        elsif from < Date.current then "From must be today or later"
        elsif to < from then "To must be on or after from"
        elsif (to - from).to_i > MAX_DAYS then "The dates may span at most #{MAX_DAYS} days"
        end
      if problem
        errors << problem
        return
      end

      [ from, to ]
    end

    # `scope`, only the listings free on the dates; all of it without them. `any`: free on at least
    # one of them rather than all (the planner's steps, RAA-315: a rental free for part of the trip
    # still shows, and its card says which part).
    def self.on(scope, from, to, any: false)
      return scope unless from

      held = ActiveRecord::Base.sanitize_sql_array([ HELD, { from:, to:, holding: Booking::HOLDING } ])
      scope.where.not(held).where(HAS_CAPACITY).or(scope.where(id: free_held_ids(scope.where(held), from, to, any:)))
    end

    # A listing's units `people` need (RAA-315): a rental vehicle's enough seats for them,
    # anything else one.
    def self.needed(listing, people)
      seats = listing.vehicle_seats
      seats ? (people.to_f / seats).ceil : 1
    end

    # A vehicle's seats in SQL, as Listing#vehicle_seats reads them (1 when it doesn't say).
    SEATS = <<~SQL.squish.freeze
      CASE WHEN jsonb_typeof(listings.attrs->'seats') = 'number' AND (listings.attrs->>'seats')::numeric >= 1
        THEN (listings.attrs->>'seats')::numeric ELSE 1 END
    SQL

    # `scope`, only the listings with enough units for `people` free on every one of the dates
    # (RAA-315: what covers the whole trip, which the planner lists first). Nothing holds an unheld
    # listing, so it covers them when its fleet seats them; a held one goes through the Ledger.
    def self.covering(scope, from, to, people:)
      held = ActiveRecord::Base.sanitize_sql_array([ HELD, { from:, to:, holding: Booking::HOLDING } ])
      fleet = ActiveRecord::Base.sanitize_sql_array([
        "(SELECT COUNT(*) FROM listing_units WHERE listing_units.listing_id = listings.id) * (#{SEATS}) >= ?", people
      ])
      held_listings = Listing.where(id: scope.where(held).select(:id)).includes(:category, :units, :stay_rate, :vehicle_rate, :tour_detail).to_a
      ledger = Availability::Ledger.new(held_listings, from, to)
      held_ids = held_listings.select { |listing| ledger.units_free(listing, days_of(listing, from, to)).to_i >= needed(listing, people) }.map(&:id)
      scope.where.not(held).where(HAS_CAPACITY).where(fleet).or(scope.where(id: held_ids))
    end

    # The longest run of the dates with enough units for `people` free on each (RAA-315), as
    # [first, last] (both included), or nil when no day has them.
    def self.free_run(listing, ledger, from, to, people)
      want = needed(listing, people)
      best = run = nil
      days_of(listing, from, to).each do |day|
        if ledger.day(listing, day)[:units_left] >= want
          run = run ? [ run.first, day ] : [ day, day ]
          best = run if best.nil? || (run.last - run.first) > (best.last - best.first)
        else
          run = nil
        end
      end
      best
    end

    # The listings in `held` (something holds them on the dates) with a unit free on them (on any
    # of them, with `any`), read once from one Ledger.
    def self.free_held_ids(held, from, to, any: false)
      listings = Listing.where(id: held.select(:id)).includes(:category, :units, :stay_rate, :vehicle_rate, :tour_detail).to_a
      ledger = Availability::Ledger.new(listings, from, to)
      listings.select do |listing|
        days = days_of(listing, from, to)
        any ? days.any? { ledger.units_free(listing, [ _1 ]).to_i.positive? } : ledger.units_free(listing, days).to_i.positive?
      end.map(&:id)
    end

    # The days a booking of these dates would take: a stay's nights and a rental's days out
    # (one, when they start and end on the same day), otherwise every day.
    def self.days_of(listing, from, to)
      nights = listing.category.accommodation? || listing.category.timed_rental?
      nights && to > from ? (from...to).to_a : (from..to).to_a
    end
  end
end
