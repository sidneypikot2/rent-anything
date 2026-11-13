module Discovery
  # One destination: the areas under it that have something to book (Cebu lists Cebu City),
  # its photos (RAA-210) and its published landmarks with their tags and photos, those of the
  # published places inside it included (RAA-285): a place pinned in Santa Fe is on Bantayan
  # Island's page too. A place to see names the active listings that visit it. Its listings are
  # not here: the pages page through them (BookCards, PlanBusinesses), as a place can have
  # thousands (the full list was dropped 2026-11-11).
  # Its page also gets to know the place (RAA-252): the guide the team wrote (blank fields as
  # nulls), where each place to see is, and for each place inside it, where it is, how many
  # stays it has and what it counts to book, the places under it included.
  class AreaDetail < ApplicationService
    GUIDE = %i[tagline description getting_there best_time_to_visit].freeze

    def initialize(area)
      @area = area
    end

    def call
      {
        area: AreaSerializer.call(@area),
        center: lat_lng(@area.center),
        guide: GUIDE.index_with { |field| @area.public_send(field).presence },
        port: @area.port,
        # Its banner's carousel, the first photo first (RAA-210).
        photos: @area.ready_photos.map { |photo| ListingPhotoSerializer.call(photo) },
        areas: @area.children.browsable.includes(:parent).order(:name).map { |area| place_json(area) },
        landmarks: landmarks.map { |landmark| landmark_json(landmark) },
        partner_count: Listing.active.in_area_tree(@area).distinct.count(:business_id),
        groups:,
        typical_prices:,
        visitor_rows:
      }
    end

    private

    # Per guest group, its active listings here and the businesses offering them, in one pass.
    def groups
      rows = Listing.active.in_area_tree(@area)
        .group(Arel.sql(Category.guest_group_sql))
        .pluck(Arel.sql(Category.guest_group_sql), Arel.sql("COUNT(*)"), Arel.sql("COUNT(DISTINCT listings.business_id)"))
      empty = { listings: 0, businesses: 0 }
      Category::GUEST_GROUPS.index_with(empty).merge(rows.to_h { |group, listings, businesses| [ group, { listings:, businesses: } ] }.compact.except(nil))
    end

    # A listing's price unit in SQL: PricingSerializer.price_unit's order (keep the two in step).
    PRICE_UNIT = <<~SQL.squish.freeze
      CASE
        WHEN EXISTS (SELECT 1 FROM stay_rates WHERE stay_rates.listing_id = listings.id AND stay_rates.nightly_price_cents > 0) THEN 'night'
        WHEN EXISTS (SELECT 1 FROM vehicle_rates WHERE vehicle_rates.listing_id = listings.id AND vehicle_rates.daily_price_cents > 0) THEN 'day'
        WHEN EXISTS (SELECT 1 FROM flat_rates WHERE flat_rates.listing_id = listings.id AND flat_rates.price_cents > 0) THEN 'trip'
        WHEN EXISTS (SELECT 1 FROM tour_details WHERE tour_details.listing_id = listings.id AND tour_details.base_price_cents > 0)
          THEN (SELECT CASE WHEN tour_type = 'private' THEN 'group' ELSE 'person' END FROM tour_details WHERE tour_details.listing_id = listings.id)
        WHEN EXISTS (SELECT 1 FROM activity_offers WHERE activity_offers.listing_id = listings.id AND activity_offers.archived_at IS NULL)
          THEN (SELECT sold_by FROM activity_details WHERE activity_details.listing_id = listings.id)
      END
    SQL

    # The banner's typical stay and tour: the upper middle from-price of the group's priced
    # listings, in the unit most of them use, so one odd price doesn't set it. Counted in SQL.
    def typical_prices
      %w[stay activity].filter_map do |group|
        priced = Listing.active.in_area_tree(@area).in_guest_group(group).where.not(price_from_cents: nil)
          .select(Arel.sql("listings.price_from_cents AS price, #{PRICE_UNIT} AS unit"))
        row = ActiveRecord::Base.connection.select_one(<<~SQL.squish)
          WITH priced AS (#{priced.to_sql}),
            usual AS (SELECT unit FROM priced WHERE unit IS NOT NULL GROUP BY unit ORDER BY COUNT(*) DESC, unit LIMIT 1)
          SELECT price, unit FROM priced WHERE unit = (SELECT unit FROM usual)
          ORDER BY price OFFSET (SELECT COUNT(*) / 2 FROM priced WHERE unit = (SELECT unit FROM usual)) LIMIT 1
        SQL
        row && { group:, price_cents: row["price"].to_i, unit: row["unit"] }
      end
    end

    # A few of the listings that visit each place to see (VISITOR_ROWS, priced first, then by
    # title), as browse rows: the place's tour lists, without every listing of the place.
    VISITOR_ROWS = 8

    def visitor_rows
      ranked = ListingLandmark.visits.joins(:listing).merge(Listing.active).where(landmark_id: landmarks.map(&:id))
        .select(Arel.sql("listing_landmarks.listing_id, ROW_NUMBER() OVER (PARTITION BY listing_landmarks.landmark_id " \
          "ORDER BY listings.price_from_cents IS NULL, listings.title, listings.id) AS rank"))
      ids = ActiveRecord::Base.connection.select_values("SELECT DISTINCT listing_id FROM (#{ranked.to_sql}) AS ranked WHERE rank <= #{VISITOR_ROWS}")
      Listing.where(id: ids).includes(*ListingRow::ASSOCIATIONS).order(:title, :id).map { |listing| ListingRow.call(listing) }
    end

    def landmarks
      @landmarks ||= Landmark.published.in_area_tree(@area).includes(:tags, :ready_photos).order(:name).to_a
    end

    # landmark id => the active listings that visit it, as { id:, title:, category:, price_from_cents: }
    # (the stored from-price, so the planner's chooser lists them without a request each, RAA-322).
    def visitors
      @visitors ||= ListingLandmark.visits.joins(listing: :category).merge(Listing.active)
        .where(landmark_id: landmarks.map(&:id)).order(:listing_id)
        .pluck(:landmark_id, :listing_id, "listings.title", "categories.name", "listings.price_from_cents")
        .group_by(&:first).transform_values do |rows|
          rows.map { |_, id, title, category, price_from_cents| { id:, title:, category:, price_from_cents: } }
        end
    end

    def landmark_json(landmark)
      {
        slug: landmark.slug,
        name: landmark.name,
        description: landmark.description,
        tags: landmark.tags.sort_by(&:name).map { |tag| TagSerializer.call(tag) },
        photos: landmark.ready_photos.map { |photo| ListingPhotoSerializer.call(photo) },
        location: lat_lng(landmark.location),
        must_see: landmark.must_see,
        boat_departure: landmark.boat_departure && lat_lng(landmark.boat_departure),
        visited_by: visitors.fetch(landmark.id, []).pluck(:id),
        visits: visitors.fetch(landmark.id, [])
      }
    end

    def place_json(area)
      counts = place_counts.fetch(area.id, {})
      AreaSerializer.call(area).merge(
        center: lat_lng(area.center),
        stay_count: counts.fetch(:stays, 0),
        to_book_count: counts.fetch(:to_book, 0)
      )
    end

    # child id => { stays: its active stays, to_book: its distinct [business, guest group]
    # pairs, as Destinations counts them }, over the published places under it, however deep:
    # counted in SQL per place, then summed up to each child.
    def place_counts
      @place_counts ||= begin
        parents = Area.published.subtree_of(@area).pluck(:id, :parent_id).to_h
        child_of = lambda do |id|
          id = parents[id] while parents[id] && parents[id] != @area.id
          id
        end
        ids_of = Category.guest_group_ids
        group_of = ids_of.flat_map { |group, ids| ids.map { [ _1, group ] } }.to_h
        rows = Listing.active.in_area_tree(@area).where.not(area_id: @area.id).distinct.pluck(:area_id, :business_id, :category_id)
        stays_in = Listing.active.where(area_id: rows.map(&:first).uniq, category_id: ids_of.fetch("stay", [])).group(:area_id).count
        rows.group_by { |area_id, _, _| child_of.call(area_id) }
          .transform_values do |rows|
            { stays: rows.map(&:first).uniq.sum { stays_in.fetch(_1, 0) },
              to_book: rows.map { |_, business_id, category_id| [ business_id, group_of[category_id] ] }.uniq.size }
          end
      end
    end

    def lat_lng(point)
      { lat: point.y.round(5), lng: point.x.round(5) }
    end
  end
end
