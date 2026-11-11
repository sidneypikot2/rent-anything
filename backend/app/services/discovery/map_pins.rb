module Discovery
  # What to book's map (2026-11-11): the active listings of a place and the published places
  # inside it that lie in the box the map shows, narrowed as its section is — its group (every
  # group without one), the search, the dates (FreeListings) and, with a group, its filters. Up
  # to CAP come as pins, each with its browse row for the pop-up; more come as clusters, counted
  # per cell of a grid an eighth of the box wide, so a place with tens of thousands of listings
  # never sends them all. A cluster sits at its listings' middle, rounded like a pin (two
  # decimals, about 1 km): no exact point reaches a guest. Stays count and pin by business, as
  # their cards do (Cards): one pin per business at its cheapest stay, with how many it stands
  # for (`options`), and clusters and `total` count businesses.
  class MapPins < ApplicationService
    CAP = 300
    # Cells across the box when clustering.
    GRID = 8

    Query = Struct.new(:messages) do
      include ActiveModel::Validations

      validate { messages.each { |message| errors.add(:base, message) } }
    end

    def initialize(area, bbox:, group: nil, from: nil, to: nil, filters: {})
      @area = area
      @params = { bbox:, group:, from:, to: }
      @filters = ListingFilters.new(filters)
    end

    def call
      read_params!

      total = pinned.count
      return { listings: [], clusters:, total:, bounds: } if total > CAP

      listings = pinned.includes(*(ListingPinSerializer::INCLUDES + ListingRow::ASSOCIATIONS).uniq).to_a
      {
        listings: listings.map { |listing| { pin: ListingPinSerializer.call(listing), row: ListingRow.call(listing), options: stays? ? listing["options"] : nil } },
        clusters: [],
        total:,
        bounds:
      }
    end

    private

    def read_params!
      errors = []
      @box = read_box(@params[:bbox])
      errors << "Bbox must be west,south,east,north in degrees" unless @box
      @group = @params[:group].presence
      errors << "Group must be one of #{Category::GUEST_GROUPS.join(', ')}" if @group && !Category::GUEST_GROUPS.include?(@group)
      @from, @to = FreeListings.read_dates(@params[:from], @params[:to], errors)
      errors.concat(@filters.errors)

      query = Query.new(errors)
      raise ActiveRecord::RecordInvalid, query if query.invalid?
    end

    # Four numbers, west before east and south before north, on the globe.
    def read_box(value)
      return unless value.is_a?(String)

      numbers = value.split(",").map { |part| Float(part, exception: false) }
      return unless numbers.size == 4 && numbers.all?

      west, south, east, north = numbers
      return unless west < east && south < north && [ west, east ].all? { _1.between?(-180, 180) } && [ south, north ].all? { _1.between?(-90, 90) }

      { west:, south:, east:, north: }
    end

    # The section's listings: with a group, its filters; the search and dates either way.
    def section
      @section ||= begin
        here = FreeListings.on(Listing.active.in_area_tree(@area), @from, @to)
        @group ? @filters.apply(here.in_guest_group(@group)) : @filters.search(here)
      end
    end

    # ... in the box.
    def inside
      @inside ||= section.where(ActiveRecord::Base.sanitize_sql_array([ "listings.location && ST_MakeEnvelope(:west, :south, :east, :north, 4326)::geography", @box ]))
    end

    def stays?
      @group == "stay"
    end

    # What gets a pin: each listing in the box, or with Stays each business's cheapest stay in it
    # (priced first, then by title, as its card leads), counting its stays there.
    def pinned
      return inside unless stays?

      @pinned ||= begin
        leads = inside
          .select("DISTINCT ON (listings.business_id) listings.*, COUNT(*) OVER (PARTITION BY listings.business_id) AS options")
          .reorder(Arel.sql("listings.business_id, #{ListingFilters::PRICE_FROM} ASC NULLS LAST, listings.title, listings.id"))
        Listing.from(Arel.sql("(#{leads.to_sql}) AS listings"))
      end
    end

    # Where all the section's listings are, rounded outwards like a pin; nil when it has none.
    def bounds
      box = ActiveRecord::Base.connection.select_one(<<~SQL.squish)
        SELECT ST_XMin(extent) AS west, ST_YMin(extent) AS south, ST_XMax(extent) AS east, ST_YMax(extent) AS north
        FROM (SELECT ST_Extent(listings.location::geometry) AS extent FROM (#{section.select(:location).to_sql}) AS listings) AS box
      SQL
      return if box.nil? || box["west"].nil?

      { west: box["west"].to_f.floor(2), south: box["south"].to_f.floor(2), east: box["east"].to_f.ceil(2), north: box["north"].to_f.ceil(2) }
    end

    def clusters
      cell = (@box[:east] - @box[:west]) / GRID
      sql = ActiveRecord::Base.sanitize_sql_array([ <<~SQL.squish, cell ])
        SELECT ROUND(ST_Y(middle)::numeric, 2) AS lat, ROUND(ST_X(middle)::numeric, 2) AS lng, count FROM (
          SELECT ST_Centroid(ST_Collect(listings.location::geometry)) AS middle, COUNT(*) AS count
          FROM (#{pinned.select(:id, :location).to_sql}) AS listings
          GROUP BY ST_SnapToGrid(listings.location::geometry, ?)
        ) AS cells ORDER BY count DESC
      SQL
      ActiveRecord::Base.connection.select_all(sql).map { |row| { lat: row["lat"].to_f, lng: row["lng"].to_f, count: row["count"].to_i } }
    end
  end
end
