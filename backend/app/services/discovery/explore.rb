module Discovery
  # What makes sense for one starting point (RAA-56, the "Destination search flow" design):
  # an area, a published landmark or a map pin. Three groups, one request:
  #
  # - listings: a region, province, city or island anchor returns what is inside it; a
  #   town, a landmark in a town, or a pin returns what is within km. Then, when the anchor
  #   is on an island, everything not on that island is dropped (the island clip), judged on
  #   the listing's exact point. Output locations are rounded as on every guest map.
  # - destinations: browsable areas and published landmarks within km (inside a province or
  #   region), island-clipped, nearest first.
  # - recommendations: the other ends of the destination links of the anchor (a landmark's
  #   and its area's; a city's, town's or pin's and those of the nearby areas). Editorial,
  #   so not clipped; they never add listings, and a linked place is not repeated as a
  #   nearby destination.
  #
  # Inside-an-area means inside its boundary, or under it in the area tree when it has none.
  class Explore < ApplicationService
    DEFAULT_KM = 15
    KM_RANGE = 1..50
    DESTINATION_LIMIT = 12
    # Anchors whose listings are the ones inside them rather than within km.
    INSIDE_KINDS = %w[region province city island].freeze
    # Anchors whose nearby destinations are the ones inside them rather than within km.
    WIDE_KINDS = %w[region province].freeze
    # Places a guest goes to; regions and provinces are only ever anchors.
    DESTINATION_KINDS = %w[city town island].freeze
    # The starting point, bound by #sanitize.
    POINT = "ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography".freeze

    def initialize(params)
      @params = params
    end

    def call
      read_params!
      resolve_anchor!

      nearby = nearby_destinations
      recommended = recommendations(nearby.select { |entry| entry[:record].is_a?(Area) }.map { |entry| entry[:record] })
      linked = recommended.to_set { |entry| entry[:record] }

      {
        anchor: anchor_json,
        listings: listings.map { |listing| ListingPinSerializer.call(listing).merge(distance_km: km_from(listing)) },
        destinations: nearby.reject { |entry| linked.include?(entry[:record]) }.first(DESTINATION_LIMIT).map { destination_json(_1) },
        recommendations: recommended.map { |entry| destination_json(entry).merge(reason: entry[:reason]) }
      }
    end

    private

    # --- Request -----------------------------------------------------------------------

    def read_params!
      errors = []
      @area_slug = slug_param(:area, errors)
      @landmark_slug = slug_param(:landmark, errors)
      pin = !@params[:lat].nil? || !@params[:lng].nil?

      anchors = [ @area_slug, @landmark_slug, pin ].count(&:present?)
      if anchors.zero?
        errors << "Give an area, a landmark, or a lat and lng"
      elsif anchors > 1
        errors << "Give only one of an area, a landmark, or a lat and lng"
      elsif pin
        @lat = number_param(:lat, -90..90, errors)
        @lng = number_param(:lng, -180..180, errors)
      end
      @km = @params[:km].nil? ? DEFAULT_KM : number_param(:km, KM_RANGE, errors)

      query = Query.new(errors)
      raise ActiveRecord::RecordInvalid, query if query.invalid?
    end

    def slug_param(key, errors)
      value = @params[key]
      return nil if value.nil?
      return value if value.is_a?(String) && value.present?

      errors << "#{key.to_s.capitalize} must be a slug"
      nil
    end

    def number_param(key, range, errors)
      value = @params[key]
      label = key.to_s.capitalize
      if value.nil?
        other = key == :lat ? "lng" : "lat"
        errors << "#{label} is required with #{other}"
        return nil
      end

      number = value.is_a?(String) ? Float(value, exception: false) : (value if value.is_a?(Numeric))
      return number.to_f if number && range.cover?(number)

      errors << "#{label} must be a number from #{range.min} to #{range.max}"
      nil
    end

    # Request errors as a model, so they are a RecordInvalid (422) like any other.
    Query = Struct.new(:messages) do
      include ActiveModel::Validations

      validate { messages.each { |message| errors.add(:base, message) } }
    end

    # --- Anchor ------------------------------------------------------------------------

    def resolve_anchor!
      if @area_slug
        @area = Area.published.find_by!(slug: @area_slug)
        @lng, @lat = @area.center.x, @area.center.y
      elsif @landmark_slug
        @landmark = Landmark.published.includes(:area).find_by!(slug: @landmark_slug)
        @area = @landmark.area
        @lng, @lat = @landmark.location.x, @landmark.location.y
      else
        @area = pin_area
      end
      @island = @area&.island
    end

    # The smallest published city, town or island whose boundary covers the pin, if any.
    def pin_area
      Area.published.where(kind: DESTINATION_KINDS).where(sanitize("ST_Covers(areas.boundary, #{POINT})"))
        .order(Arel.sql("ST_Area(areas.boundary)")).first
    end

    def pin?
      @landmark.nil? && @area_slug.nil?
    end

    # Listings inside the anchor area instead of within km.
    def inside_anchor?
      !pin? && INSIDE_KINDS.include?(@area.kind)
    end

    def wide_anchor?
      @area_slug && WIDE_KINDS.include?(@area.kind)
    end

    # SQL with the starting point (:lat, :lng), the radius (:meters) and any extra values bound.
    def sanitize(sql, **values)
      ActiveRecord::Base.sanitize_sql_array([ sql, { lng: @lng, lat: @lat, meters: @km * 1000, **values } ])
    end

    def distance(column)
      sanitize("ST_Distance(#{column}, #{POINT}) AS distance_m")
    end

    # Areas never offered as somewhere to go from here: the anchor area and those above it.
    # A landmark's own area stays (Kawasan Falls leads to Badian).
    def excluded_area_ids
      @excluded_area_ids ||= begin
        lineage = @area ? @area.lineage.map(&:id) : []
        @landmark ? lineage - [ @area.id ] : lineage
      end
    end

    # --- Queries -----------------------------------------------------------------------

    def listings
      scope = Listing.active.includes(:category, :area)
        .select("listings.*", distance("listings.location"))
      scope = inside_anchor? ? inside(scope, @area, "listings.location", :area_id) : within_km(scope, "listings.location")
      scope = inside(scope, @island, "listings.location", :area_id) if @island
      scope.order(Arel.sql("distance_m"), :id)
    end

    # Areas and landmarks, nearest first, each as { record:, distance_m: }.
    def nearby_destinations
      areas = Area.browsable.where(kind: DESTINATION_KINDS).where.not(id: excluded_area_ids)
        .select("areas.*", distance("areas.center"))
      landmarks = Landmark.published.includes(:area).where.not(id: @landmark&.id)
        .select("landmarks.*", distance("landmarks.location"))

      areas = place_scope(areas, "areas.center", :id)
      landmarks = place_scope(landmarks, "landmarks.location", :area_id)

      (areas.to_a + landmarks.to_a)
        .map { |record| { record:, distance_m: record.distance_m } }
        .sort_by { |entry| entry[:distance_m] }
    end

    def place_scope(scope, column, tree_column)
      scope = wide_anchor? ? inside(scope, @area, column, tree_column) : within_km(scope, column)
      scope = inside(scope, @island, column, tree_column) if @island
      scope.order(Arel.sql("distance_m")).limit(DESTINATION_LIMIT * 4)
    end

    def recommendations(nearby_areas)
      sources = recommendation_sources(nearby_areas)
      return [] if sources.empty?

      candidates = {}
      sources.map { |source| DestinationLink.for(source) }.reduce(:or).each do |link|
        [ [ link.source_type, link.source_id, link.target_type, link.target_id ],
          [ link.target_type, link.target_id, link.source_type, link.source_id ] ].each do |from_type, from_id, type, id|
          next unless sources.any? { |source| source.class.name == from_type && source.id == from_id }

          key = [ type, id ]
          best = candidates[key]
          candidates[key] = link if best.nil? || link.weight > best.weight
        end
      end
      candidates.reject! { |(type, id), _| type == "Area" ? excluded_area_ids.include?(id) : id == @landmark&.id }

      linked_places(candidates.keys).map do |record|
        link = candidates.fetch([ record.class.name, record.id ])
        { record:, distance_m: record.distance_m, reason: link.kind, weight: link.weight }
      end.sort_by { |entry| [ -entry[:weight], entry[:distance_m] ] }
    end

    def recommendation_sources(nearby_areas)
      if @landmark
        [ @landmark, @area ]
      elsif pin?
        [ @area, *nearby_areas ].compact
      elsif %w[city town].include?(@area.kind)
        [ @area, *nearby_areas ]
      else
        [ @area ]
      end.uniq
    end

    # Linked places a guest can go to: areas that are browsable or have a published
    # landmark, and published landmarks.
    def linked_places(keys)
      area_ids = keys.filter_map { |type, id| id if type == "Area" }
      landmark_ids = keys.filter_map { |type, id| id if type == "Landmark" }

      areas = Area.where(id: area_ids)
        .merge(Area.browsable.or(Area.published.where(id: Landmark.published.select(:area_id))))
        .select("areas.*", distance("areas.center"))
      landmarks = Landmark.published.includes(:area).where(id: landmark_ids)
        .select("landmarks.*", distance("landmarks.location"))
      areas.to_a + landmarks.to_a
    end

    def within_km(scope, column)
      scope.where(sanitize("ST_DWithin(#{column}, #{POINT}, :meters)"))
    end

    # Inside the area's boundary, or under it in the tree when it has none.
    def inside(scope, area, column, tree_column)
      if area.boundary
        scope.where(sanitize("ST_Covers((SELECT bounds.boundary FROM areas bounds WHERE bounds.id = :area_id), #{column})",
          area_id: area.id))
      else
        scope.where(tree_column => Area.subtree_of(area).select(:id))
      end
    end

    # --- JSON --------------------------------------------------------------------------

    def anchor_json
      record = @landmark || (@area unless pin?)
      {
        type: pin? ? "pin" : (@landmark ? "landmark" : "area"),
        slug: record&.slug,
        name: record&.name,
        kind: @landmark || pin? ? nil : @area.kind,
        isolated_to: @island && { slug: @island.slug, name: @island.name },
        location: { lat: @lat.round(5), lng: @lng.round(5) }
      }
    end

    def destination_json(entry)
      record = entry[:record]
      area = record.is_a?(Area)
      {
        type: area ? "area" : "landmark",
        slug: record.slug,
        name: record.name,
        kind: area ? record.kind : nil,
        area_slug: area ? record.slug : record.area.slug,
        location: lat_lng(area ? record.center : record.location),
        distance_km: (entry[:distance_m] / 1000.0).round(1)
      }
    end

    # An area's center or a landmark's point: public places, so exact.
    def lat_lng(point)
      { lat: point.y, lng: point.x }
    end

    def km_from(record)
      (record.distance_m / 1000.0).round(1)
    end
  end
end
