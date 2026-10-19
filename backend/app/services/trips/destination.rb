module Trips
  # Where a trip goes, for its name and for suggesting a trip to an undated item (RAA-64,
  # decision 7): the published island the listing's area is on, otherwise its town or city.
  # Never a province, which would put Bantayan, Moalboal and Cebu City together.
  module Destination
    PLACE_KINDS = %w[city town].freeze
    NAME_LENGTH = 80

    # Same rule as Area#island, over one walk up the tree.
    def self.for(area)
      lineage = area.lineage
      lineage.find { |place| place.island? && place.published? } ||
        lineage.find { |place| PLACE_KINDS.include?(place.kind) }
    end

    # The same rule for many areas in one query (RAA-70): { area_id => destination }.
    def self.for_areas(area_ids)
      return {} if area_ids.empty?

      Area.find_by_sql([ <<~SQL.squish, area_ids, PLACE_KINDS ]).to_h { |place| [ place.start_id, place ] }
        WITH RECURSIVE up(start_id, id, parent_id, depth) AS (
          SELECT id, id, parent_id, 0 FROM areas WHERE id IN (?)
          UNION ALL
          SELECT up.start_id, parents.id, parents.parent_id, up.depth + 1
          FROM areas parents JOIN up ON parents.id = up.parent_id
        )
        SELECT DISTINCT ON (up.start_id) up.start_id, areas.* FROM up JOIN areas ON areas.id = up.id
        WHERE (areas.kind = 'island' AND areas.status = 'published') OR areas.kind IN (?)
        ORDER BY up.start_id, (areas.kind = 'island' AND areas.status = 'published') DESC, up.depth
      SQL
    end

    # "Bantayan Island · Nov 12–15"; the destination alone without dates. A long place name
    # is shortened so the name fits a trip's 80 characters.
    def self.trip_name(area, starts_on, ends_on)
      with_dates(self.for(area)&.name || area.name, starts_on, ends_on)
    end

    # A trip name made by #trip_name, moved to the trip's new dates (RAA-137): "Bantayan
    # Island · Oct 22" becomes "Bantayan Island · Oct 21–24". Nil for a name that doesn't end
    # with the old dates, which the guest typed (or there were none to tell it by).
    def self.redated(name, (was_from, was_to), (from, to))
      suffix = was_from && " · #{dates(was_from, was_to)}"
      return unless suffix && name.end_with?(suffix)

      with_dates(name.delete_suffix(suffix), from, to)
    end

    def self.with_dates(place, starts_on, ends_on)
      return place.truncate(NAME_LENGTH) unless starts_on

      suffix = " · #{dates(starts_on, ends_on)}"
      place.truncate(NAME_LENGTH - suffix.length) + suffix
    end

    def self.dates(from, to)
      if from == to
        from.strftime("%b %-d")
      elsif from.year != to.year
        "#{from.strftime('%b %-d, %Y')} – #{to.strftime('%b %-d, %Y')}"
      elsif from.month != to.month
        "#{from.strftime('%b %-d')} – #{to.strftime('%b %-d')}"
      else
        "#{from.strftime('%b %-d')}–#{to.day}"
      end
    end
  end
end
