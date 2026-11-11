module Discovery
  # One page of a What to book section (/<area>/book, 2026-11-10): the cards of one guest group in
  # a place and the published places inside it (Cards: a stay's business, any other a business's
  # listing title), each with its listings as the browse rows have them (ListingRow) — priced
  # cards first, then by title, unless a distance search orders them. The guest's filters and
  # search apply listing by listing (ListingFilters), so a card keeps only its listings that pass;
  # `facets` counts the filter sheet's choices, `counts` the cards each group has with the search
  # (the section chips, which sections show; `counts: false` leaves them to BookCounts, which the
  # web app asks once for the page); the map fetches its own pins (MapPins). `around` answers with the page holding that listing (a link to its
  # row); `listing_ids` keeps only those listings, in that order (the map's distance search).
  # `from` / `to` (the dates the guest picked on the page, 2026-11-11) keep only the listings with
  # a unit free on them (Availability::Ledger): a stay's and a vehicle rental's nights from `from`
  # to the day before `to` (they count the days they start), anything else every day of it.
  class BookCards < ApplicationService
    PER_PAGE = 18

    Query = Struct.new(:messages) do
      include ActiveModel::Validations

      validate { messages.each { |message| errors.add(:base, message) } }
    end

    MAX_DAYS = FreeListings::MAX_DAYS
    # How long a section's facets are kept (FACETS_TTL), keyed to when the place's listings last
    # changed: a booking or a rate change shows in the counts within it, the cards at once.
    FACETS_TTL = 2.minutes

    def initialize(area, group:, page: nil, per_page: nil, around: nil, listing_ids: nil, from: nil, to: nil, facets: nil, counts: nil, filters: {})
      @area = area
      @params = { group:, page:, per_page:, around:, listing_ids:, from:, to:, facets:, counts: }
      @filters = ListingFilters.new(filters)
    end

    def call
      read_params!

      @page = page_around if @around
      # One page of card keys from the database, never all of them.
      shown = ordered.limit(@per_page).offset((@page - 1) * @per_page).pluck(*columns).map { |key| Array(key) }
      {
        cards: cards_of(shown),
        total: Cards.count(shown_listings, @group),
        page: @page,
        per_page: @per_page,
        facets: @with_facets ? section_facets : nil,
        counts: @with_counts ? BookCounts.in(here, @filters) : nil
      }
    end

    private

    def read_params!
      errors = []
      @group = @params[:group]
      errors << "Group must be one of #{Category::GUEST_GROUPS.join(', ')}" unless Category::GUEST_GROUPS.include?(@group)
      @page = whole(@params[:page], 1)
      errors << "Page must be a whole number from 1" unless @page.is_a?(Integer) && @page >= 1
      @per_page = whole(@params[:per_page], PER_PAGE)
      errors << "Per page must be a whole number from 1 to #{PER_PAGE}" unless @per_page.is_a?(Integer) && @per_page.between?(1, PER_PAGE)
      @around = whole(@params[:around], nil)
      errors << "Around must be a listing id" unless @around.nil? || @around.is_a?(Integer)
      ids = @params[:listing_ids]
      @only = ids.is_a?(Array) ? ids.map { |id| whole(id, nil) } : ids
      errors << "Listing ids must be a list of whole numbers" unless @only.nil? || (@only.is_a?(Array) && @only.all?(Integer))
      read_dates!(errors)
      @with_facets = flag(@params[:facets])
      errors << "Facets must be true or false" if @with_facets.nil?
      @with_counts = flag(@params[:counts])
      errors << "Counts must be true or false" if @with_counts.nil?
      errors.concat(@filters.errors)

      query = Query.new(errors)
      raise ActiveRecord::RecordInvalid, query if query.invalid?
    end

    def read_dates!(errors)
      @from, @to = FreeListings.read_dates(@params[:from], @params[:to], errors)
    end

    # A true/false query flag, true when missing or blank, nil otherwise.
    def flag(value)
      value.nil? || value == "" ? true : ListingFilters::FLAGS[value.to_s]
    end

    # A whole number from a query string, `default` when missing or blank, :invalid otherwise.
    def whole(value, default)
      return default if value.nil? || value == ""
      return value if value.is_a?(Integer)

      (Integer(value, 10, exception: false) if value.is_a?(String)) || :invalid
    end

    # The filter sheet's counts for the section, kept a short while (FACETS_TTL): counting them
    # reads every listing of the group, and the section's later pages, the other guests and the
    # page's own reloads ask for the same.
    def section_facets
      changed = Listing.in_area_tree(@area).pick(Arel.sql("MAX(listings.updated_at)"))
      key = [ "book-facets", @area.id, @group, @from, @to, @filters.key, changed&.to_f ]
      Rails.cache.fetch(key, expires_in: FACETS_TTL) { @filters.facets(in_group, @group) }
    end

    # The place's listings, only those free on the dates when there are any, so the cards, facets,
    # counts and pins all agree.
    def here
      @here ||= FreeListings.on(Listing.active.in_area_tree(@area), @from, @to)
    end

    def in_group
      here.in_guest_group(@group)
    end

    # The group's listings the search and the filters leave.
    def passing
      @filters.apply(in_group)
    end

    # ... and, in a distance search, only those in range.
    def shown_listings
      @only ? passing.where(id: @only) : passing
    end

    def columns
      Cards.columns(@group).map { |column| Arel.sql(column) }
    end

    # The cards in the page's order: by the distance search's order, else priced first, then by
    # title and business.
    def ordered
      scope = shown_listings.group(*columns)
      if @only
        position = ActiveRecord::Base.sanitize_sql_array([ "MIN(array_position(ARRAY[?]::bigint[], listings.id))", @only.presence || [ 0 ] ])
        scope = scope.order(Arel.sql(position))
      end
      scope.order(Arel.sql("BOOL_OR((#{ListingFilters::PRICE_FROM}) IS NOT NULL) DESC"), Arel.sql("MIN(listings.title)"), "listings.business_id")
    end

    # The page holding `around`'s card (page 1 when it isn't shown): the one request that reads
    # every card's key, for a link to a row.
    def page_around
      card = shown_listings.where(id: @around).pick(*columns)
      index = card && ordered.pluck(*columns).index { |key| Array(key) == Array(card) }
      index ? (index / @per_page) + 1 : 1
    end

    # Each card with its listings that pass, priced first, then by title.
    def cards_of(keys)
      return [] if keys.empty?

      listings = shown_listings.where(business_id: keys.map(&:first).uniq).includes(*ListingRow::ASSOCIATIONS).to_a
      key_of = shown_listings.where(id: listings.map(&:id)).pluck(:id, *columns).to_h { |id, *key| [ id, key ] }
      by_card = listings.group_by { |listing| key_of.fetch(listing.id) }
      keys.map do |key|
        rows = by_card.fetch(key).sort_by { |listing| [ PricingSerializer.price_from_cents(listing) ? 0 : 1, listing.title, listing.id ] }
        # Keyed by its lowest listing id, as PlanBusinesses does, so a filter never changes a card's key.
        business_id = rows.first.business_id
        { key: @group == "stay" ? business_id.to_s : "#{business_id}-#{rows.map(&:id).min}", listings: rows.map { |listing| ListingRow.call(listing) } }
      end
    end
  end
end
