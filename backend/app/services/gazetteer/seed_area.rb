module Gazetteer
  # Makes one area a destination from the admin console (RAA-168), what `gazetteer:publish`,
  # `gazetteer:wikidata` and /seed-place's landmark search do by hand:
  #
  # 1. publishes the area and every area above it;
  # 2. matches them to Wikidata, so the area's own item is known before landmarks are looked up;
  # 3. adds Wikidata's landmark-like items inside the area's boundary as draft landmarks (CC0;
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
      taken = @area.landmarks.flat_map { [ _1.name, *_1.aliases, *_1.wikidata_aliases ] }.to_set { SearchTerm.normalize(_1) }
      center = @area.center
      items = Wikidata.landmarks_near(lat: center.y, lng: center.x, radius_km:)
      items = items.reject { held.include?(_1[:id]) || taken.include?(SearchTerm.normalize(_1[:name])) }
      items.select { inside?(_1) }.first(MAX_LANDMARKS).count { create_landmark(_1) }
    end

    def create_landmark(item)
      slug = [ item[:name].parameterize, "#{item[:name].parameterize}-#{@area.slug}" ].find { !Landmark.exists?(slug: _1) }
      return false if slug.blank?

      @area.landmarks.create!(slug:, name: item[:name], status: "draft", wikidata_id: item[:id],
        location: "POINT(#{item[:lng]} #{item[:lat]})")
    end

    def inside?(item)
      return true if @area.boundary.nil?

      Area.where(id: @area.id)
        .exists?([ "ST_Covers(boundary, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)", item[:lng], item[:lat] ])
    end

    # Far enough from the center to reach the boundary's furthest corner.
    def radius_km
      return DEFAULT_RADIUS_KM if @area.boundary.nil?

      meters = Area.where(id: @area.id).pick(Arel.sql(<<~SQL.squish))
        GREATEST(
          ST_Distance(center, ST_SetSRID(ST_MakePoint(ST_XMin(boundary::geometry), ST_YMin(boundary::geometry)), 4326)::geography),
          ST_Distance(center, ST_SetSRID(ST_MakePoint(ST_XMax(boundary::geometry), ST_YMax(boundary::geometry)), 4326)::geography),
          ST_Distance(center, ST_SetSRID(ST_MakePoint(ST_XMin(boundary::geometry), ST_YMax(boundary::geometry)), 4326)::geography),
          ST_Distance(center, ST_SetSRID(ST_MakePoint(ST_XMax(boundary::geometry), ST_YMin(boundary::geometry)), 4326)::geography)
        )
      SQL
      (meters / 1000.0).ceil.clamp(DEFAULT_RADIUS_KM, MAX_RADIUS_KM)
    end

    def finish(status, **report)
      @area.update!(seed_status: status, seeded_at: Time.current, seed_report: report)
      @area
    end
  end
end
