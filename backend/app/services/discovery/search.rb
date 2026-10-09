module Discovery
  # The guest search box: one query over areas, published landmarks, tags and active
  # listings, grouped by kind. Matching ignores case and accents (unaccent), finds the query
  # anywhere in a name or alias, and tolerates small typos (pg_trgm word similarity). Within
  # a group: exact name or alias first, then terms that start with the query, then the rest
  # by similarity, and the more popular place on a tie. Only places that lead somewhere
  # bookable show: areas when they or an area under them have an active listing, landmarks
  # and tags when they are in such an area.
  #
  # Areas, landmarks and tags are matched against the search_terms view (RAA-60), one row
  # per name and alias; listings against their title and category, live.
  class Search < ApplicationService
    MIN_LENGTH = 2
    LIMIT = 5
    # word_similarity above this counts as a typo match ("fort sn pedro" -> Fort San Pedro).
    TYPO_THRESHOLD = 0.5

    def initialize(query)
      @query = query
    end

    def call
      check_query!

      {
        areas: areas.map { |area| AreaSerializer.call(area) },
        landmarks: landmarks.map { |landmark| landmark_json(landmark) },
        tags: tag_results,
        listings: listings.map { |listing| ListingSummarySerializer.call(listing) }
      }
    end

    private

    def check_query!
      query = Query.new(@query)
      raise ActiveRecord::RecordInvalid, query if query.invalid?
    end

    def areas
      matching_terms(Area.browsable.includes(:parent))
    end

    def landmarks
      matching_terms(Landmark.published.where(area_id: Area.bookable.select(:id)).includes(:area))
    end

    def tags
      bookable_tags = LandmarkTag.joins(:landmark).merge(Landmark.published)
        .where(landmarks: { area_id: Area.bookable.select(:id) }).select(:tag_id)
      matching_terms(Tag.where(id: bookable_tags))
    end

    # Filters and orders a relation of areas, landmarks or tags by its best-matching term in
    # search_terms: rank, then similarity, then popularity.
    def matching_terms(relation)
      table = relation.klass.table_name
      matches = sanitize(<<~SQL.squish, type: relation.klass.name)
        SELECT target_id,
          MIN(CASE WHEN term_normalized = :q THEN 0
                   WHEN term_normalized LIKE :prefix THEN 1
                   WHEN term_normalized LIKE :contains THEN 2
                   ELSE 3 END) AS rank,
          MAX(word_similarity(:q, term_normalized)) AS similarity,
          MAX(popularity) AS popularity
        FROM search_terms
        WHERE target_type = :type
          AND (term_normalized LIKE :contains OR word_similarity(:q, term_normalized) > :threshold)
        GROUP BY target_id
      SQL

      relation
        .joins("JOIN (#{matches}) matches ON matches.target_id = #{table}.id")
        .order(Arel.sql("matches.rank, matches.similarity DESC, matches.popularity DESC, #{table}.name, #{table}.id"))
        .limit(LIMIT)
    end

    def listings
      columns = %w[listings.title categories.name].map { |column| normalized(column) }
      conditions = columns.map { |column| "#{column} LIKE :contains OR word_similarity(:q, #{column}) > :threshold" }
      title = normalized("listings.title")

      Listing.active.joins(:category).includes(:category, :area)
        .where(sanitize(conditions.join(" OR ")))
        .order(Arel.sql(sanitize(<<~SQL.squish)))
          CASE WHEN #{title} = :q THEN 0
               WHEN #{title} LIKE :prefix THEN 1
               WHEN #{title} LIKE :contains THEN 2
               ELSE 3 END,
          word_similarity(:q, #{title}) DESC,
          listings.title
        SQL
        .limit(LIMIT)
    end

    def normalized(column)
      "unaccent(lower(#{column}))"
    end

    def sanitize(sql, extra = {})
      ActiveRecord::Base.sanitize_sql_array([ sql, binds.merge(extra) ])
    end

    def binds
      @binds ||= begin
        q = SearchTerm.normalize(@query)
        like = ActiveRecord::Base.sanitize_sql_like(q)
        { q: q, contains: "%#{like}%", prefix: "#{like}%", threshold: TYPO_THRESHOLD }
      end
    end

    def landmark_json(landmark)
      { slug: landmark.slug, name: landmark.name, area: { slug: landmark.area.slug, name: landmark.area.name } }
    end

    def tag_results
      matched = tags.to_a
      areas = TagAreas.call(matched.map(&:id))
      matched.map { |tag| TagSerializer.call(tag).merge(areas: areas.fetch(tag.id, [])) }
    end

    # The query as a model, so a bad one is a RecordInvalid (422) like any other.
    Query = Struct.new(:text) do
      include ActiveModel::Validations

      validate do
        next if text.is_a?(String) && text.strip.length >= MIN_LENGTH

        errors.add(:base, "Search needs at least #{MIN_LENGTH} characters")
      end
    end
  end
end
