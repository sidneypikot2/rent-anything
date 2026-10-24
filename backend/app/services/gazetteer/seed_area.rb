module Gazetteer
  # Makes one area a destination from the admin console (RAA-168), what `gazetteer:publish`,
  # `gazetteer:wikidata` and /seed-place's landmark search do by hand:
  #
  # 1. publishes the area and every area above it;
  # 2. matches them to Wikidata, so the area's own item is known before landmarks are looked up;
  # 3. adds Wikidata's landmark-like items inside the area's boundary (for an island, also
  #    inside its towns' or within ISLAND_MARGIN_METERS of its own) as draft landmarks (CC0;
  #    OpenStreetMap is ruled out, db/gazetteer/README.md), skipping items another place holds
  #    and names or aliases the area's landmarks already answer to;
  # 4. enriches all the area's landmarks, drafts included, and refreshes search.
  #
  # Safe to run again. Records the run in seed_status, seeded_at and seed_report; a Wikidata
  # failure marks it failed and keeps what was done before it.
  class SeedArea < ApplicationService
    MAX_LANDMARKS = 15
    DEFAULT_RADIUS_KM = 10
    MAX_RADIUS_KM = 40
    # An island's outline is its landmass, so the islets, sandbars and reefs off it fall
    # outside (RAA-170). Off Bantayan most are within 2.6 km, Virgin Island and Hilantagaan
    # 2.4 and 3.5 km; mainland Cebu starts at 12.5 km. Not for towns and cities, whose
    # outlines touch their neighbours'.
    ISLAND_MARGIN_METERS = 5_000

    def initialize(area)
      @area = area
    end

    def call
      @area.update!(seed_status: "running")
      @area.publish!
      areas = enrich(@area.lineage)
      added = add_landmarks
      landmarks = enrich(@area.landmarks.order(:id).to_a)
      SearchTerm.refresh(concurrently: true)
      finish("done", landmarks_added: added, enriched: areas[:enriched] + landmarks[:enriched],
        skipped: areas[:skipped] + landmarks[:skipped])
    rescue Wikidata::Error => e
      finish("failed", error: e.message)
    end

    private

    def enrich(places)
      WikidataEnrichment.call(places:)
    end

    def add_landmarks
      held = Area.where.not(wikidata_id: nil).pluck(:wikidata_id).to_set + Landmark.where.not(wikidata_id: nil).pluck(:wikidata_id)
      taken = @area.landmarks.flat_map { [ _1.name, *_1.aliases, *_1.wikidata_aliases ] }.to_set { name_key(_1) }
      center = @area.center
      items = Wikidata.landmarks_near(lat: center.y, lng: center.x, radius_km:)
      items = items.reject { held.include?(_1[:id]) || taken.include?(name_key(_1[:name])) }
      items.select { nearby?(_1) }.first(MAX_LANDMARKS).count { create_landmark(_1) }
    end

    # Silion and Silion Island are one place, as are Virgin Island and Virgin Islet.
    def name_key(name)
      SearchTerm.normalize(name).sub(/\s+(island|islet)\z/, "")
    end

    def create_landmark(item)
      slug = [ item[:name].parameterize, "#{item[:name].parameterize}-#{@area.slug}" ].find { !Landmark.exists?(slug: _1) }
      return false if slug.blank?

      @area.landmarks.create!(slug:, name: item[:name], status: "draft", wikidata_id: item[:id],
        location: "POINT(#{item[:lng]} #{item[:lat]})")
    end

    # Inside the boundary, or off an island's coast and in no other area.
    def nearby?(item)
      return true if @area.boundary.nil?

      point = [ "ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography", item[:lng], item[:lat] ]
      covers = [ "ST_Covers(boundary, #{point[0]})", *point[1..] ]
      return true if Area.where(id: @area.id).exists?(covers)
      return false unless @area.island?
      # An island's towns own its outlying islands: Kinatarcan, 15 km off Bantayan, is in Santa Fe.
      return true if own_areas.exists?(covers)

      Area.where(id: @area.id).exists?([ "ST_DWithin(boundary, #{point[0]}, ?)", *point[1..], ISLAND_MARGIN_METERS ]) &&
        !Area.where(kind: Area::SERVING_KINDS).where.not(id: own_areas.select(:id)).exists?(covers)
    end

    # The area and, for an island, every area under it.
    def own_areas
      @area.island? ? Area.subtree_of(@area) : Area.where(id: @area.id)
    end

    # Far enough from the center to reach the furthest corner of the area's boundary, or for an
    # island of its towns' boundaries too, plus its margin.
    def radius_km
      return DEFAULT_RADIUS_KM if @area.boundary.nil?

      meters = Area.connection.select_value(Area.sanitize_sql_array([ <<~SQL.squish, own_areas.where.not(boundary: nil).ids, @area.id ]))
        SELECT GREATEST(
          ST_Distance(area.center, ST_SetSRID(ST_MakePoint(ST_XMin(ext.box), ST_YMin(ext.box)), 4326)::geography),
          ST_Distance(area.center, ST_SetSRID(ST_MakePoint(ST_XMin(ext.box), ST_YMax(ext.box)), 4326)::geography),
          ST_Distance(area.center, ST_SetSRID(ST_MakePoint(ST_XMax(ext.box), ST_YMin(ext.box)), 4326)::geography),
          ST_Distance(area.center, ST_SetSRID(ST_MakePoint(ST_XMax(ext.box), ST_YMax(ext.box)), 4326)::geography)
        )
        FROM (SELECT ST_Extent(boundary::geometry) AS box FROM areas WHERE id IN (?)) AS ext, areas AS area
        WHERE area.id = ?
      SQL
      meters += ISLAND_MARGIN_METERS if @area.island?
      (meters / 1000.0).ceil.clamp(DEFAULT_RADIUS_KM, MAX_RADIUS_KM)
    end

    def finish(status, **report)
      @area.update!(seed_status: status, seeded_at: Time.current, seed_report: report)
      @area
    end
  end
end
