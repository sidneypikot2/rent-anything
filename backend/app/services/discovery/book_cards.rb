module Discovery
  # One page of a What to book section (/<area>/book, 2026-11-10): the cards of one guest group in
  # a place and the published places inside it (Cards: a stay's business, any other a business's
  # listing title), each with its listings as the browse rows have them (ListingRow) — priced
  # cards first, then by title, unless a distance search orders them. The guest's filters and
  # search apply listing by listing (ListingFilters), so a card keeps only its listings that pass;
  # `facets` counts the filter sheet's choices, `counts` the cards each group has with the search
  # (the section rail, which sections show), and `pin_ids` every listing that passes (the map
  # hides the rest's pins). `around` answers with the page holding that listing (a link to its
  # row); `listing_ids` keeps only those listings, in that order (the map's distance search).
  class BookCards < ApplicationService
    PER_PAGE = 18

    Query = Struct.new(:messages) do
      include ActiveModel::Validations

      validate { messages.each { |message| errors.add(:base, message) } }
    end

    def initialize(area, group:, page: nil, per_page: nil, around: nil, listing_ids: nil, filters: {})
      @area = area
      @params = { group:, page:, per_page:, around:, listing_ids: }
      @filters = ListingFilters.new(filters)
    end

    def call
      read_params!

      keys = ordered.pluck(*columns).map { |key| Array(key) }
      @page = page_around(keys) if @around
      shown = keys.slice((@page - 1) * @per_page, @per_page) || []
      {
        cards: cards_of(shown),
        total: keys.size,
        page: @page,
        per_page: @per_page,
        facets: @filters.facets(in_group, @group),
        counts: Category::GUEST_GROUPS.index_with { |group| Cards.count(@filters.search(here.in_guest_group(group)), group) },
        pin_ids: passing.pluck(:id).sort
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
      errors.concat(@filters.errors)

      query = Query.new(errors)
      raise ActiveRecord::RecordInvalid, query if query.invalid?
    end

    # A whole number from a query string, `default` when missing or blank, :invalid otherwise.
    def whole(value, default)
      return default if value.nil? || value == ""
      return value if value.is_a?(Integer)

      (Integer(value, 10, exception: false) if value.is_a?(String)) || :invalid
    end

    def here
      Listing.active.in_area_tree(@area)
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

    # The page holding `around`'s card (page 1 when it isn't shown).
    def page_around(keys)
      card = shown_listings.where(id: @around).pick(*columns)
      index = card && keys.index(Array(card))
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
