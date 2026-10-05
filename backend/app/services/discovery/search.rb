module Discovery
  # The guest search box: one query over areas, published landmarks, tags and active
  # listings, grouped by kind. Matching ignores case and accents (unaccent), finds the query
  # anywhere in a name or alias, and tolerates small typos (pg_trgm word similarity). Within
  # a group: exact name first, then names that start with the query, then the rest by
  # similarity. Areas show only when they or an area under them have something to book.
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
        tags: tags.map { |tag| tag_json(tag) },
        listings: listings.map { |listing| ListingSummarySerializer.call(listing) }
      }
    end

    private

    def check_query!
      query = Query.new(@query)
      raise ActiveRecord::RecordInvalid, query if query.invalid?
    end

    def areas
      matching(Area.browsable.includes(:parent), "areas")
    end

    def landmarks
      matching(Landmark.published.includes(:area), "landmarks")
    end

    def tags
      matching(Tag.all, "tags")
    end

    def listings
      matching(Listing.active.joins(:category).includes(:category, :area), "listings", name: "listings.title",
        extra: "categories.name")
    end

    # Filters and orders a relation by the query against `name` (or the given column) and,
    # when the table has them, its aliases.
    def matching(relation, table, name: "#{table}.name", extra: nil)
      columns = [ name, extra ].compact
      aliases = relation.klass.column_names.include?("aliases") ? "#{table}.aliases" : nil

      conditions = columns.map { |column| "#{normalized(column)} LIKE :contains OR word_similarity(:q, #{normalized(column)}) > :threshold" }
      conditions << "EXISTS (SELECT 1 FROM unnest(#{aliases}) AS a(alias_name) WHERE #{normalized('a.alias_name')} LIKE :contains)" if aliases

      exact = [ "#{normalized(name)} = :q" ]
      exact << ":q = ANY (SELECT #{normalized('a.alias_name')} FROM unnest(#{aliases}) AS a(alias_name))" if aliases

      relation
        .where(sanitize(conditions.join(" OR ")))
        .order(Arel.sql(sanitize(<<~SQL.squish)))
          CASE WHEN #{exact.join(' OR ')} THEN 0
               WHEN #{normalized(name)} LIKE :prefix THEN 1
               WHEN #{normalized(name)} LIKE :contains THEN 2
               ELSE 3 END,
          word_similarity(:q, #{normalized(name)}) DESC,
          #{name}
        SQL
        .limit(LIMIT)
    end

    def normalized(column)
      "unaccent(lower(#{column}))"
    end

    def sanitize(sql)
      ActiveRecord::Base.sanitize_sql_array([ sql, binds ])
    end

    def binds
      @binds ||= begin
        q = ActiveRecord::Base.connection.select_value(
          ActiveRecord::Base.sanitize_sql_array([ "SELECT unaccent(lower(?))", @query.strip ])
        )
        like = ActiveRecord::Base.sanitize_sql_like(q)
        { q: q, contains: "%#{like}%", prefix: "#{like}%", threshold: TYPO_THRESHOLD }
      end
    end

    def landmark_json(landmark)
      { slug: landmark.slug, name: landmark.name, area: { slug: landmark.area.slug, name: landmark.area.name } }
    end

    def tag_json(tag)
      TagSerializer.call(tag).merge(areas: TagAreas.call(tag))
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
