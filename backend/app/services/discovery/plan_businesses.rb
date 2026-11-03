module Discovery
  # One page of a plan step's options (plan a whole trip, /plan/<area>), by business: the
  # businesses with active listings in one guest group in a place and the published places
  # inside it, each with what it offers there summed up — how many, the first's title, the
  # lowest price, photos from each, its first listing's rounded point and the published places
  # to see its listings go to. Its card opens the business's own page. Things to do lead with the
  # businesses whose tours go to the most of the guest's hearted places, then those with a price;
  # everything else is by name. `counts` says how many listings each group has here, so the
  # steps show only the ones with something.
  class PlanBusinesses < ApplicationService
    PER_PAGE = 18
    PHOTOS = 6

    # Bad parameters, as a 422 (Explore's way).
    Query = Struct.new(:messages) do
      include ActiveModel::Validations

      validate { messages.each { |message| errors.add(:base, message) } }
    end

    def initialize(area, group:, page: nil, hearted: nil)
      @area = area
      @params = { group:, page:, hearted: }
    end

    def call
      read_params!

      ids = ordered.offset((@page - 1) * PER_PAGE).limit(PER_PAGE).pluck("listings.business_id")
      listings = in_group.where(business_id: ids).includes(*ListingRow::ASSOCIATIONS).to_a
      goes_to = goes_to_of(listings.map(&:id))
      by_business = listings.group_by(&:business_id)
      {
        businesses: ids.map { |id| row(by_business.fetch(id), goes_to) },
        total: in_group.distinct.count(:business_id),
        page: @page,
        per_page: PER_PAGE,
        hearted_total: hearted_total,
        counts:
      }
    end

    private

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

      query = Query.new(errors)
      raise ActiveRecord::RecordInvalid, query if query.invalid?
    end

    def here
      Listing.active.in_area_tree(@area)
    end

    def in_group
      here.in_guest_group(@group)
    end

    def tours?
      @group == "activity"
    end

    # The businesses, one row each, in the page's order.
    def ordered
      scope = in_group.joins(:business).group("listings.business_id", "businesses.name")
      if tours?
        scope = scope.left_joins(:tour_detail)
        scope = scope.order(Arel.sql("MAX((#{hearted_count_sql})) DESC")) if @hearted.any?
        scope = scope.order(Arel.sql("BOOL_OR(COALESCE(tour_details.base_price_cents, 0) > 0) DESC"))
      end
      scope.order("businesses.name", "listings.business_id")
    end

    # How many of the hearted places a listing's tour goes to (some hearted).
    def hearted_count_sql
      ListingLandmark.visits.joins(:landmark).merge(Landmark.published)
        .where("listing_landmarks.listing_id = listings.id").where(landmarks: { slug: @hearted })
        .select("COUNT(*)").to_sql
    end

    def hearted_total
      return 0 unless tours? && @hearted.any?

      in_group.where("(#{hearted_count_sql}) > 0").distinct.count(:business_id)
    end

    # listing id => the slugs of the published places to see it goes to.
    def goes_to_of(ids)
      ListingLandmark.visits.joins(:landmark).merge(Landmark.published).where(listing_id: ids)
        .order("landmarks.name").pluck(:listing_id, "landmarks.slug")
        .group_by(&:first).transform_values { |pairs| pairs.map(&:last) }
    end

    # A business's card: its listings here, the ones to hearted places first, then by title.
    def row(listings, goes_to)
      hearted = ->(listing) { (goes_to.fetch(listing.id, []) & @hearted).size }
      listings = listings.sort_by { |listing| [ -hearted.call(listing), listing.title, listing.id ] }
      first = listings.first
      priced = listings.filter_map { |listing| PricingSerializer.price_from_cents(listing)&.then { |cents| [ cents, listing ] } }.min_by(&:first)
      photos = listings.flat_map { |listing| listing.ready_photos.first(1) } + listings.flat_map { |listing| listing.ready_photos.drop(1) }
      {
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
        goes_to: listings.flat_map { |listing| goes_to.fetch(listing.id, []) }.uniq.sort
      }
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
