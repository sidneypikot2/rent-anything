module Gazetteer
  # Enriches published areas and landmarks from Wikidata (RAA-62): their labels and aliases
  # in English, Filipino and Cebuano as extra search terms, and a starting popularity from
  # how many Wikipedias cover them and how often the English article is read. Safe to run
  # again: it replaces only wikidata_aliases and wikidata_popularity, never the curated
  # aliases, and keeps a wikidata_id once set (so an admin can correct a match by hand).
  #
  # A place without an item is matched once: an area by its PSGC code, else by name near
  # its center; a landmark by name near it. Only a single match is stored; anything else is
  # reported in :skipped for an admin to settle.
  class WikidataEnrichment < ApplicationService
    AREA_RADIUS_KM = 10
    LANDMARK_RADIUS_KM = 2
    MAX_TERM_LENGTH = 60
    BATCH_SIZE = 50

    def initialize
      @resolved = @enriched = 0
      @skipped = []
      # Which place holds each item, so no two places end up with the same one.
      @holders = (Area.where.not(wikidata_id: nil).to_a + Landmark.where.not(wikidata_id: nil).to_a)
        .index_by(&:wikidata_id).transform_values { |place| label(place) }
    end

    def call
      places = Area.published.order(:id).to_a + Landmark.published.order(:id).to_a
      matched = places.filter_map { |place| [ place, place.wikidata_id || resolve(place) ] }.select(&:last)
      matched.each_slice(BATCH_SIZE) { |batch| enrich(batch) }
      { resolved: @resolved, enriched: @enriched, skipped: @skipped }
    end

    private

    def resolve(place)
      ids = candidates(place)
      return skip(place, ids.empty? ? "no Wikidata item matches" : "#{ids.size} Wikidata items match") unless ids.one?

      id = ids.first
      return skip(place, "#{id} is already #{@holders[id]}") if @holders.key?(id)

      @holders[id] = label(place)
      @resolved += 1
      id
    rescue Wikidata::Error => e
      skip(place, e.message)
    end

    def candidates(place)
      if place.is_a?(Area)
        code = old_psgc_code(place.psgc_code)
        ids = code ? Wikidata.find_by_psgc(code) : []
        ids.presence || Wikidata.find_near(name: place.name, lat: place.center.y, lng: place.center.x, radius_km: AREA_RADIUS_KM)
      else
        Wikidata.find_near(name: place.name, lat: place.location.y, lng: place.location.x, radius_km: LANDMARK_RADIUS_KM)
      end
    end

    # The 10-digit code's 3-digit province part was 2 digits before 2019: 0702237000 → 072237000.
    def old_psgc_code(code)
      "#{code[0, 2]}#{code[3..]}" if code&.match?(/\A\d{2}0\d{7}\z/)
    end

    def enrich(batch)
      entities = Wikidata.entities(batch.map(&:last).uniq)
      batch.each do |place, id|
        entity = entities[id]
        next skip(place, "#{id} is not on Wikidata") unless entity

        place.update_columns(wikidata_id: id, wikidata_aliases: new_terms(place, entity[:terms]),
          wikidata_popularity: popularity(entity))
        @enriched += 1
      rescue Wikidata::Error => e
        skip(place, e.message)
      end
    rescue Wikidata::Error => e
      batch.each { |place, _| skip(place, e.message) }
    end

    # Terms the place doesn't already answer to, without bot-made labels such as
    # "Moalboal, Sugbo" or "Moalboal (lungsod)".
    def new_terms(place, terms)
      taken = [ place.name, *place.aliases ].to_set { |term| SearchTerm.normalize(term) }
      terms.map(&:strip).reject { |term| term.length > MAX_TERM_LENGTH || term.match?(/[(),]|\A[\d\s]*\z/) }
        .select { |term| taken.add?(SearchTerm.normalize(term)) }.sort
    end

    # Sitelinks plus log2 of the article's monthly views: 20 Wikipedias and 500 views is 29,
    # so a big city doesn't drown out the listings and landmarks counted by search_terms.
    def popularity(entity)
      views = entity[:enwiki] ? Wikidata.monthly_pageviews(entity[:enwiki]) : 0
      entity[:sitelinks] + Math.log2(1 + views).round
    end

    def skip(place, reason)
      @skipped << "#{label(place)}: #{reason}"
      nil
    end

    def label(place)
      "#{place.class.name} #{place.slug}"
    end
  end
end
