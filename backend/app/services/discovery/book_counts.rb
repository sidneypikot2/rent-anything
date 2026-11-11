module Discovery
  # How many cards each What to book section has in a place (its section chips, 2026-11-11): the
  # cards per guest group here and in the published places inside it, with the page's search and
  # dates but not a section's filters. Asked once for the page rather than with every section's
  # page of cards (BookCards' `counts`), since it reads every listing of the place.
  class BookCounts < ApplicationService
    # The counts of `free`, the place's listings already narrowed to the dates (FreeListings.on).
    def self.in(free, filters)
      Cards.counts(filters.search(free))
    end

    def initialize(area, q: nil, from: nil, to: nil)
      @area = area
      @params = { q:, from:, to: }
    end

    def call
      errors = []
      from, to = FreeListings.read_dates(@params[:from], @params[:to], errors)
      filters = ListingFilters.new(q: @params[:q])
      errors.concat(filters.errors)
      query = BookCards::Query.new(errors)
      raise ActiveRecord::RecordInvalid, query if query.invalid?

      { counts: self.class.in(FreeListings.on(Listing.active.in_area_tree(@area), from, to), filters) }
    end
  end
end
