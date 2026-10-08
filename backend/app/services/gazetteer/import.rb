module Gazetteer
  # Loads the gazetteer (RAA-59) into areas: every region, province, city and town from the
  # PSA's PSGC with its COD-AB boundary, then the curated islands. Safe to run again: areas
  # are matched by PSGC code, so a quarterly re-run only updates them. The files are
  # prepared once by script/gazetteer-prepare; db/gazetteer/README.md has the sources.
  #
  # New areas are drafts. A hand-made area listed in curated.yml keeps its slug, name,
  # center, aliases and status, and only gains its code, boundary and parent.
  class Import < ApplicationService
    DIR = Rails.root.join("db/gazetteer")
    KIND_ORDER = %w[region province city town].freeze
    # A town mostly on an island moves under it (Santa Fe under Bantayan Island). Only half,
    # because COD-AB's town and coastline outlines differ and towns own islets: 54 % of
    # Santa Fe's polygon is on the Bantayan landmass, 0 % of Daanbantayan's.
    ON_ISLAND = 0.5

    def initialize(areas: DIR.join("areas.geojson.gz"), landmasses: DIR.join("landmasses.geojson.gz"),
      curated: DIR.join("curated.yml"))
      @features = read_features(areas)
      @landmasses = read_features(landmasses)
      @curated = YAML.safe_load_file(curated)
      @by_code = {}
      @created = @updated = 0
    end

    def call
      Area.transaction do
        claim_curated_areas
        @features.sort_by { |feature| KIND_ORDER.index(feature["properties"]["kind"]) }.each { |feature| upsert(feature) }
        @curated.fetch("islands").each { |island| build_island(island) }
      end
      { created: @created, updated: @updated, islands: @curated.fetch("islands").size }
    end

    private

    def read_features(path)
      text = path.to_s.end_with?(".gz") ? Zlib::GzipReader.open(path, &:read) : File.read(path)
      JSON.parse(text).fetch("features")
    end

    def curated_slugs
      @curated_slugs ||= @curated.fetch("areas").keys.to_set
    end

    def curated_slug(code)
      @curated.fetch("areas").key(code)
    end

    def claim_curated_areas
      @curated.fetch("areas").each do |slug, code|
        Area.where(slug:, psgc_code: nil).update_all(psgc_code: code)
      end
    end

    def upsert(feature)
      properties = feature["properties"]
      geometry = feature["geometry"]&.to_json
      area = Area.find_or_initialize_by(psgc_code: properties.fetch("psgc_code"))
      area.kind = properties.fetch("kind")
      area.parent = @by_code[properties["parent_psgc_code"]]

      if area.new_record?
        name = tidy(properties.fetch("name"))
        area.assign_attributes(name:, slug: curated_slug(area.psgc_code) || free_slug(name, area.parent), status: "draft",
          aliases: name == properties["name"] ? [] : [ properties["name"] ],
          center: center_for(geometry, area.parent, properties["psgc_code"]))
        @created += 1
      else
        area.name = tidy(properties.fetch("name")) unless curated_slugs.include?(area.slug)
        @updated += 1
      end

      area.save!
      set_boundary(area, geometry)
      @by_code[area.psgc_code] = area
    end

    # PSGC spells some names the official way round: "City of Talisay" is Talisay City to a
    # guest, "Region VII (Central Visayas)" is Central Visayas, the capital is just Cebu City,
    # and "National Capital Region (NCR)" drops its acronym. The PSGC name stays an alias.
    def tidy(name)
      name = name.sub(/\s*\(Capital\)\z/i, "").strip
      return "#{$1} City" if name =~ /\ACity of (.+)\z/i
      return $1 if name =~ /\ARegion [IVX]+-?[AB]? \((.+)\)\z/
      return $1 if name =~ /\A(.+) \([A-Z]+\)\z/

      name
    end

    def free_slug(name, parent)
      base = name.parameterize
      [ base, "#{base}-#{parent&.name&.parameterize}", "#{base}-#{SecureRandom.hex(3)}" ].find do |slug|
        !slug.end_with?("-") && !Area::RESERVED_SLUGS.include?(slug) && !curated_slugs.include?(slug) &&
          !Area.exists?(slug:)
      end
    end

    # Inside the place's own boundary; without one, its parent's center, or else a point
    # inside its first child (the Negros Island Region is newer than COD-AB).
    def center_for(geometry, parent, code)
      return point_on_surface(geometry) if geometry
      return parent.center if parent

      child = @features.find { |feature| feature["properties"]["parent_psgc_code"] == code && feature["geometry"] }
      point_on_surface(child["geometry"].to_json) if child
    end

    def point_on_surface(geometry)
      Area.connection.select_value(
        Area.sanitize_sql([ "SELECT ST_AsText(ST_PointOnSurface(ST_GeomFromGeoJSON(?)))", geometry ]))
    end

    def set_boundary(area, geometry)
      return unless geometry

      Area.where(id: area.id).update_all([ <<~SQL.squish, geometry ])
        boundary = ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)), 3))::geography
      SQL
    end

    # An island is the landmass under its curated point. The towns mostly on it move under
    # it, and the island sits under their province; an island that is only part of one town
    # (Malapascua, in Daanbantayan) sits under that town instead.
    def build_island(spec)
      lng, lat = spec.fetch("point")
      point = "SRID=4326;POINT(#{lng} #{lat})"
      landmass = landmass_at(lng, lat, point) or raise ArgumentError, "No landmass under #{spec["slug"]}"

      island = Area.find_or_initialize_by(slug: spec.fetch("slug"))
      if island.new_record?
        island.assign_attributes(name: spec.fetch("name"), aliases: spec.fetch("aliases", []), kind: "island",
          status: "draft", center: "POINT(#{lng} #{lat})")
      end
      island.parent ||= smallest_covering(Area.where(kind: "province"), point)
      island.save!
      set_boundary(island, landmass)

      towns = Area.subtree_of(island.parent).where(kind: %w[city town]).where.not(boundary: nil)
      on_island = towns.where(<<~SQL.squish, island.id)
        ST_Area(ST_Intersection(areas.boundary::geometry, (SELECT boundary::geometry FROM areas WHERE id = ?))::geography)
          >= #{ON_ISLAND} * ST_Area(areas.boundary)
      SQL
      if (town = on_island.first)
        island.update!(parent: town.parent) unless town.parent == island
        on_island.update_all(parent_id: island.id)
      else
        island.update!(parent: smallest_covering(towns, point) || island.parent)
      end
    end

    # Checked in PostGIS, after a cheap bounding-box test here: there are 3,637 landmasses.
    def landmass_at(lng, lat, point)
      @landmasses.lazy.map { |feature| feature["geometry"] }.select { |geometry| in_bbox?(geometry, lng, lat) }
        .map(&:to_json).find do |geometry|
          Area.connection.select_value(Area.sanitize_sql([
            "SELECT ST_Covers(ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)::geography, ST_GeogFromText(?))", geometry, point
          ]))
        end
    end

    def in_bbox?(geometry, lng, lat)
      return false unless geometry&.dig("coordinates")&.any?

      lngs, lats = geometry["coordinates"].flatten.each_slice(2).to_a.transpose
      lng.between?(lngs.min, lngs.max) && lat.between?(lats.min, lats.max)
    end

    def smallest_covering(scope, point)
      scope.where("ST_Covers(areas.boundary, ST_GeogFromText(?))", point).order(Arel.sql("ST_Area(areas.boundary)")).first
    end
  end
end
