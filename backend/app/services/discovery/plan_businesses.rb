module Discovery
  # One page of a plan step's options (plan a whole trip, /plan/<area>), as cards: a stay's card
  # is a business, any other one listing title of a business ("Mio 125" by one shop, its two
  # "Fortuner" listings together), from the active listings in one guest group in a place and the
  # published places inside it, each card with what it offers there summed up — how many, the first's title, the
  # lowest price, photos from each, its first listing's rounded point and the published places
  # to see its listings go to. Its card opens the business's own page. Things to do lead with the
  # businesses whose tours go to the most of the guest's hearted places, then those with a price;
  # stays lead with the businesses closest to the hearted places, on average, by their closest
  # listing, and `near` says how far each is (a boat-only place from where its boats leave);
  # everything else is by name. `counts` says how many listings each group has here, so the
  # steps show only the ones with something.
  class PlanBusinesses < ApplicationService
    PER_PAGE = 18
    PHOTOS = 6
    # Where a stay is measured to. `near` is worked out from exact points but only ever says
    # half kilometres: finer, and distances to a few known places would give the point away.
    PICK_POINT = "COALESCE(landmarks.boat_departure, landmarks.location)".freeze
    NEAR_STEP_KM = 0.5

    # Bad parameters, as a 422 (Explore's way).
    Query = Struct.new(:messages) do
      include ActiveModel::Validations

      validate { messages.each { |message| errors.add(:base, message) } }
    end

    # filters: the step's own (ListingFilters, What to book's for its category), applied listing
    # by listing, so a card keeps only its listings that pass; `facets` counts the choices.
    # from / to: the trip's dates (RAA-315): only listings free on at least one of them.
    # people: with the dates, who a vehicle must seat; a card covers the trip when one of its
    # listings has enough units for them free on every day (RAA-315), and those cards come first.
    def initialize(area, group:, page: nil, hearted: nil, filters: {}, from: nil, to: nil, people: nil)
      @area = area
      @params = { group:, page:, hearted:, from:, to:, people: }
      @filters = ListingFilters.new(filters)
    end

    def call
      read_params!
      return page unless @from

      # With dates, the date filter and the whole-trip order push Postgres' cost estimate past
      # jit_above_cost at a large place, and compiling cost more than it saved (perf-island,
      # 6,300 rentals: 242 ms with JIT, 166 without; RAA-315), as for the facets (ListingFilters).
      ActiveRecord::Base.transaction do
        ActiveRecord::Base.connection.execute("SET LOCAL jit = off")
        page
      end
    end

    private

    def page
      keys = ordered.offset((@page - 1) * PER_PAGE).limit(PER_PAGE).pluck(*card_columns).map { |key| Array(key) }
      in_page = in_group.where(business_id: keys.map(&:first).uniq)
      key_of = in_page.pluck(:id, *card_columns.drop(1).map { |column| Arel.sql(column) }).to_h { |id, *rest| [ id, rest ] }
      listings = in_page.includes(*ListingRow::ASSOCIATIONS).to_a
      cover = cover_of(listings)
      goes_to = goes_to_of(listings.map(&:id))
      metres = metres_to_picks(listings.map(&:id))
      by_card = listings.group_by { |listing| [ listing.business_id, *key_of.fetch(listing.id) ] }
      {
        businesses: keys.map { |key| row(by_card.fetch(key), goes_to, metres, cover) },
        total: in_group.group(*card_columns.map { |column| Arel.sql(column) }).count.size,
        page: @page,
        per_page: PER_PAGE,
        hearted_total: hearted_total,
        counts:,
        facets: @filters.facets(here.in_guest_group(@group), @group)
      }
    end

    # group is one of the guest groups; page a whole number from 1 (1 when missing or blank); hearted a
    # list of slugs. Anything else is a 422.
    def read_params!
      errors = []
      @group = @params[:group]
      errors << "Group must be one of #{Category::GUEST_GROUPS.join(', ')}" unless Category::GUEST_GROUPS.include?(@group)
      page = @params[:page]
      @page = page.blank? ? 1 : (page.is_a?(Integer) ? page : (Integer(page, 10, exception: false) if page.is_a?(String)))
      errors << "Page must be a whole number from 1" unless @page.is_a?(Integer) && @page >= 1
      hearted = @params[:hearted]
      @hearted = hearted.nil? ? [] : hearted
      errors << "Hearted must be a list of slugs" unless @hearted.is_a?(Array) && @hearted.all?(String)
      @hearted = @hearted.uniq if errors.empty?
      @from, @to = FreeListings.read_dates(@params[:from], @params[:to], errors)
      people = @params[:people]
      @people = people.blank? ? 1 : (people.is_a?(Integer) ? people : (Integer(people, 10, exception: false) if people.is_a?(String)))
      errors << "People must be a whole number from 1" unless @people.is_a?(Integer) && @people >= 1
      errors.concat(@filters.errors)

      query = Query.new(errors)
      raise ActiveRecord::RecordInvalid, query if query.invalid?
    end

    def here
      @here ||= FreeListings.on(Listing.active.in_area_tree(@area), @from, @to, any: true)
    end

    # The group's listings here that the filters leave.
    def in_group
      @filters.apply(here.in_guest_group(@group))
    end

    def tours?
      @group == "activity"
    end

    def stays?
      @group == "stay"
    end

    # What makes a card: a stay's business, or a business and a listing title.
    def card_columns
      Cards.columns(@group)
    end

    # The cards, one row each, in the page's order.
    def ordered
      scope = in_group.joins(:business).group(*card_columns.map { |column| Arel.sql(column) }, "businesses.name")
      scope = scope.order(Arel.sql("BOOL_OR(listings.id IN (#{covering.select(:id).to_sql})) DESC")) if covers?
      if tours?
        scope = scope.left_joins(:tour_detail)
        scope = scope.order(Arel::Nodes::NamedFunction.new("MAX", [ hearted_count ]).desc) if @hearted.any?
        scope = scope.order(Arel.sql("BOOL_OR(COALESCE(tour_details.base_price_cents, 0) > 0) DESC"))
      end
      scope = scope.order(Arel::Nodes::NamedFunction.new("MIN", [ average_metres ]).asc) if near_picks?
      scope = scope.order("businesses.name", "listings.business_id")
      stays? ? scope : scope.order(Arel.sql(Cards::TITLE_KEY))
    end

    # The published places hearted, for ranking stays.
    def picks
      Landmark.published.where(slug: @hearted)
    end

    def near_picks?
      return @near_picks if defined?(@near_picks)

      @near_picks = stays? && @hearted.any? && picks.exists?
    end

    # How far a listing is from the picks on average, as a subquery.
    def average_metres
      picks.select(Arel.sql("AVG(ST_Distance(listings.location, #{PICK_POINT}))")).arel
    end

    # listing id => { pick's slug => metres }, from the listings' exact points.
    def metres_to_picks(ids)
      return {} unless near_picks?

      Listing.where(id: ids).joins("CROSS JOIN landmarks").merge(picks)
        .pluck(:id, "landmarks.slug", Arel.sql("ST_Distance(listings.location, #{PICK_POINT})"))
        .group_by(&:first).transform_values { |rows| rows.to_h { |_, slug, metres| [ slug, metres ] } }
    end

    # How far the business's closest listing is from each pick, nearest pick first.
    def near_of(listings, metres)
      closest = listings.filter_map { |listing| metres[listing.id] }.min_by { |each| each.values.sum }
      return [] unless closest

      closest.map { |slug, distance| { slug:, km: ((distance / 1000.0) / NEAR_STEP_KM).round * NEAR_STEP_KM } }
        .sort_by { |each| [ each[:km], each[:slug] ] }
    end

    # The visits of a listing's tour to the hearted places (some hearted).
    def hearted_visits
      ListingLandmark.visits.joins(:landmark).merge(Landmark.published)
        .where("listing_landmarks.listing_id = listings.id").where(landmarks: { slug: @hearted })
    end

    # How many of the hearted places a listing's tour goes to, as a subquery.
    def hearted_count
      hearted_visits.select(Arel.star.count).arel
    end

    def hearted_total
      return 0 unless tours? && @hearted.any?

      in_group.where(hearted_visits.arel.exists).group(*card_columns.map { |column| Arel.sql(column) }).count.size
    end

    # listing id => the slugs of the published places to see it goes to.
    def goes_to_of(ids)
      ListingLandmark.visits.joins(:landmark).merge(Landmark.published).where(listing_id: ids)
        .order("landmarks.name").pluck(:listing_id, "landmarks.slug")
        .group_by(&:first).transform_values { |pairs| pairs.map(&:last) }
    end

    # Whether cards say if they cover the trip: rentals (vehicles and gear) with the dates; a tour
    # or a transfer is a day of it, never all of it.
    def covers?
      @from && %w[rental gear].include?(@group)
    end

    # The group's listings that cover the whole trip (FreeListings.covering), with the dates.
    def covering
      @covering ||= FreeListings.covering(in_group, @from, @to, people: @people)
    end

    # The page's listings with the dates: the ids covering the trip, and each one's longest run of
    # days with enough free (one Ledger for the page).
    def cover_of(listings)
      return nil unless covers?

      ledger = Availability::Ledger.new(listings, @from, @to)
      {
        ids: covering.where(id: listings.map(&:id)).pluck(:id).to_set,
        runs: listings.to_h { |listing| [ listing.id, FreeListings.free_run(listing, ledger, @from, @to, @people) ] }
      }
    end

    # A card: its listings here, the ones to hearted places first, then by title.
    def row(listings, goes_to, metres, cover)
      hearted = ->(listing) { (goes_to.fetch(listing.id, []) & @hearted).size }
      listings = listings.sort_by { |listing| [ -hearted.call(listing), listing.title, listing.id ] }
      first = listings.first
      priced = listings.filter_map { |listing| PricingSerializer.price_from_cents(listing)&.then { |cents| [ cents, listing ] } }.min_by(&:first)
      photos = listings.flat_map { |listing| listing.ready_photos.first(1) } + listings.flat_map { |listing| listing.ready_photos.drop(1) }
      {
        key: stays? ? first.business_id.to_s : "#{first.business_id}-#{listings.map(&:id).min}",
        id: first.business.id,
        name: first.business.name,
        title: first.title,
        category: first.category.name,
        area_name: first.area.name,
        listings_count: listings.size,
        listing_ids: listings.map(&:id),
        instant_book: listings.any?(&:instant_book?),
        price_from_cents: priced&.first,
        price_unit: priced && PricingSerializer.price_unit(priced.last),
        photos: photos.first(PHOTOS).map { |photo| ListingPhotoSerializer.call(photo) },
        location: { lat: first.location.y.round(2), lng: first.location.x.round(2) },
        goes_to: listings.flat_map { |listing| goes_to.fetch(listing.id, []) }.uniq.sort,
        **cover_fields(listings, cover),
        near: near_of(listings, metres)
      }
    end

    # Whether the card covers the trip and, when not, its longest free run of its listings.
    def cover_fields(listings, cover)
      return { covers_trip: nil, free_days: nil } unless cover

      covers = listings.any? { |listing| cover[:ids].include?(listing.id) }
      run = covers ? nil : listings.filter_map { |listing| cover[:runs][listing.id] }.max_by { |first, last| last - first }
      { covers_trip: covers, free_days: run && { from: run.first, to: run.last } }
    end

    # Every group, 0 when it has none here.
    def counts
      by_category = here.group(:category_id).count
      categories = Category.includes(:parent).where(id: by_category.keys).index_by(&:id)
      by_category.each_with_object(Category::GUEST_GROUPS.index_with(0)) do |(id, count), totals|
        totals[categories[id].guest_group] += count
      end
    end
  end
end
