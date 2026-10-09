module Trips
  # Where a trip goes, for its name and for suggesting a trip to an undated item (RAA-64,
  # decision 7): the published island the listing's area is on, otherwise its town or city.
  # Never a province, which would put Bantayan, Moalboal and Cebu City together.
  module Destination
    PLACE_KINDS = %w[city town].freeze

    def self.for(area)
      area.island || area.lineage.find { |place| PLACE_KINDS.include?(place.kind) }
    end

    # "Bantayan Island · Nov 12–15"; the destination alone without dates.
    def self.trip_name(area, starts_on, ends_on)
      place = self.for(area)&.name || area.name
      starts_on ? "#{place} · #{dates(starts_on, ends_on)}" : place
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
