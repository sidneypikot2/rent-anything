module Trips
  # Which of a guest's trips an item should go to (RAA-64, decision 8), so the add sheet
  # can preselect it. Only trips that haven't ended count.
  #
  # A dated item goes to the trip with the smallest gap between their dates (0 when they
  # overlap), up to GAP_DAYS; a tie goes to the trip with an item nearest the listing. An
  # undated item goes to the most recently edited trip with the same destination. Nothing
  # suitable means "New trip", named new_trip_name. extends_to is set when the trip's dates
  # would have to grow to take the item.
  class Suggest < ApplicationService
    GAP_DAYS = 3

    def initialize(user, listing:, starts_on:, ends_on:)
      @user = user
      @listing = listing
      @starts_on = starts_on
      @ends_on = ends_on
    end

    def call
      trip = @starts_on ? by_dates : by_destination
      {
        trip:,
        extends_to: trip && extension(trip),
        new_trip_name: Destination.trip_name(@listing.area, @starts_on, @ends_on)
      }
    end

    private

    def by_dates
      gap = Trip.sanitize_sql_array([ "GREATEST(trips.starts_on - ?::date, ?::date - trips.ends_on, 0)", @ends_on, @starts_on ])
      nearest_item = Trip.sanitize_sql_array([ <<~SQL.squish, @listing.id ])
        (SELECT MIN(ST_Distance(listings.location, (SELECT location FROM listings WHERE id = ?)))
         FROM trip_items JOIN listings ON listings.id = trip_items.listing_id
         WHERE trip_items.trip_id = trips.id)
      SQL

      @user.trips.current.where.not(starts_on: nil)
        .where("#{gap} <= ?", GAP_DAYS)
        .order(Arel.sql("#{gap}, #{nearest_item} NULLS LAST, trips.updated_at DESC"))
        .first
    end

    def by_destination
      destination = Destination.for(@listing.area)
      return unless destination

      destinations = Hash.new { |cache, area| cache[area] = Destination.for(area) }
      @user.trips.current.includes(items: { listing: :area }).order(updated_at: :desc)
        .find { |trip| trip.items.any? { |item| destinations[item.listing.area] == destination } }
    end

    def extension(trip)
      return unless @starts_on && trip.dated?
      return if trip.starts_on <= @starts_on && @ends_on <= trip.ends_on

      { starts_on: [ trip.starts_on, @starts_on ].min, ends_on: [ trip.ends_on, @ends_on ].max }
    end
  end
end
