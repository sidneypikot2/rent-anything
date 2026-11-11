module Discovery
  # A guest's filters on one group of listings, as What to book and the plan's steps offer them
  # (2026-11-10): free cancellation, pet-friendly stays, a price range on the "from" price, a
  # rental's vehicle (its category), transmission, drop-off, pick-up at the end and child helmets,
  # what the listings include, and a search. Read from the request (`errors` for a 422), applied
  # in SQL listing by listing (a card keeps only its listings that pass), and counted for the
  # filter sheet (`facets`), in cards. Includes are keys; the web app words them (its chips'
  # labels): `guide`, `licence`, `bathroom:<kind>`, `amenity:<name>`, `accessory:<name>` (an
  # accessory or a lens) and `feature:<name>` (a jet ski's). The facets are counted in the
  # database (2026-11-11), never listing by listing in Ruby.
  class ListingFilters
    FLAGS = { "true" => true, "1" => true, "false" => false, "0" => false }.freeze
    BOOLEANS = %i[free_cancellation pets delivery pickup child_helmets].freeze
    LISTS = %i[kinds transmissions includes].freeze
    # The request's keys, all optional.
    PARAMS = [ *BOOLEANS, :min_price_cents, :max_price_cents, *LISTS, :q ].freeze
    # A rental's handover, by the fee its rate sets (nil: not offered).
    FEES = { delivery: "delivery_fee_cents", pickup: "return_pickup_fee_cents", child_helmets: "child_helmet_fee_cents" }.freeze
    # A listing's from-price in SQL: stored on it (listings.price_from_cents, 2026-11-11) and kept
    # by the database as its rates, tour and offers change (listing_price_from, which follows
    # PricingSerializer.price_from_cents); null while it has none.
    PRICE_FROM = "listings.price_from_cents".freeze
    # What a search reads: the title, its kind, who offers it, where, and its description.
    SEARCH_TEXT = <<~SQL.squish.freeze
      CONCAT_WS(' ', listings.title, categories.name, businesses.name, areas.name, listings.description)
    SQL
    # A text value of a listing's attrs, null when missing, not text or blank.
    ATTR_TEXT = ->(key) { "CASE WHEN jsonb_typeof(listings.attrs->'#{key}') = 'string' AND TRIM(listings.attrs->>'#{key}') <> '' THEN listings.attrs->>'#{key}' END" }
    # A list in a listing's attrs, each entry with a prefix ('amenity:raincoat').
    ATTR_LIST = lambda do |key, prefix|
      list = "CASE WHEN jsonb_typeof(listings.attrs->'#{key}') = 'array' THEN listings.attrs->'#{key}' ELSE '[]'::jsonb END"
      "SELECT '#{prefix}:' || value AS key FROM jsonb_array_elements_text(#{list}) AS value WHERE TRIM(value) <> ''"
    end
    # What a listing includes, as an array of keys (the chips the web app offers under Includes).
    INCLUDES_SQL = <<~SQL.squish.freeze
      ARRAY_REMOVE(ARRAY[
        CASE WHEN listings.attrs->'guide_included' = 'true'::jsonb THEN 'guide' END,
        CASE WHEN listings.attrs->'licence_required' = 'true'::jsonb THEN 'licence' END,
        'bathroom:' || (#{ATTR_TEXT.call('bathroom')})
      ], NULL) || ARRAY(SELECT DISTINCT key FROM (
        #{ATTR_LIST.call('amenities', 'amenity')} UNION ALL #{ATTR_LIST.call('accessories', 'accessory')}
        UNION ALL #{ATTR_LIST.call('lenses', 'accessory')} UNION ALL #{ATTR_LIST.call('features', 'feature')}
      ) AS listed)
    SQL
    FREE_CANCELLATION_SQL = "listings.cancellation_policy IN (#{Listing::FREE_CANCELLATION_POLICIES.map { "'#{_1}'" }.join(', ')})".freeze
    # The filter sheet's counts over the facts (a CTE named `facts`), in one statement. Each count is
    # of cards, so the listings are first grouped by card (hashing, not sorting, at 50k listings);
    # the includes' are among the listings the other filters leave (`passing`).
    FACETS_SQL = <<~SQL.squish.freeze
      by_card AS (
        SELECT card, BOOL_OR(free_cancellation) AS free_cancellation, BOOL_OR(pets) AS pets,
          BOOL_OR(delivery) AS delivery, BOOL_OR(pickup) AS pickup, BOOL_OR(child_helmets) AS child_helmets
        FROM facts GROUP BY card
      ),
      includes_by_card AS (
        SELECT key, card, BOOL_OR(passing) AS passing, COUNT(*) AS listings
        FROM facts CROSS JOIN LATERAL unnest(includes) AS key GROUP BY key, card
      )
      SELECT json_build_object(
        'cards', (SELECT row_to_json(totals) FROM (SELECT COUNT(*) AS cards,
          COUNT(*) FILTER (WHERE free_cancellation) AS free_cancellation, COUNT(*) FILTER (WHERE pets) AS pets,
          COUNT(*) FILTER (WHERE delivery) AS delivery, COUNT(*) FILTER (WHERE pickup) AS pickup,
          COUNT(*) FILTER (WHERE child_helmets) AS child_helmets
          FROM by_card) AS totals),
        'listings', (SELECT row_to_json(totals) FROM (SELECT COUNT(*) AS listings,
          MIN(price) AS price_min_cents, MAX(price) AS price_max_cents, COALESCE(BOOL_OR(price IS NULL), false) AS unpriced,
          (ARRAY_AGG(booking_type ORDER BY id) FILTER (WHERE price IS NULL))[1] AS unpriced_booking_type,
          COALESCE(BOOL_AND(pets), false) AS pets, MIN(policy) = MAX(policy) AS one_policy, MIN(policy) AS policy
          FROM facts) AS totals),
        'kinds', (SELECT json_agg(json_build_array(slug, name, count)) FROM
          (SELECT slug, name, COUNT(*) AS count FROM (SELECT DISTINCT slug, name, card FROM facts) AS each GROUP BY slug, name) AS kinds),
        'transmissions', (SELECT json_agg(json_build_array(transmission, count)) FROM
          (SELECT transmission, COUNT(*) AS count FROM (SELECT DISTINCT transmission, card FROM facts WHERE transmission IS NOT NULL) AS each
           GROUP BY transmission) AS transmissions),
        'includes', (SELECT json_agg(json_build_array(key, passing, listings)) FROM
          (SELECT key, COUNT(*) FILTER (WHERE passing) AS passing, SUM(listings) AS listings FROM includes_by_card GROUP BY key) AS includes)
      )
    SQL

    attr_reader :errors

    def initialize(params)
      @errors = []
      @params = params.to_h.symbolize_keys
      BOOLEANS.each { |key| instance_variable_set(:"@#{key}", read_flag(key)) }
      @min_price = read_cents(:min_price_cents)
      @max_price = read_cents(:max_price_cents)
      LISTS.each { |key| instance_variable_set(:"@#{key}", read_list(key)) }
      @words = read_words
    end

    # The filters and search as read, for a cache key: two requests that filter alike share it.
    def key
      [ *BOOLEANS.map { instance_variable_get(:"@#{_1}") }, @min_price, @max_price,
        *LISTS.map { instance_variable_get(:"@#{_1}").sort }, @words ].to_json
    end

    # Whether any filter (not the search) is set.
    def any?
      BOOLEANS.any? { |key| instance_variable_get(:"@#{key}") } || @min_price || @max_price || LISTS.any? { |key| instance_variable_get(:"@#{key}").any? }
    end

    # Only the listings the search finds.
    def search(scope)
      return scope if @words.empty?

      scope = scope.joins(:category, :business, :area)
      @words.reduce(scope) { |each, word| each.where("#{SEARCH_TEXT} ILIKE ?", "%#{ActiveRecord::Base.sanitize_sql_like(word)}%") }
    end

    # Only the listings the search and the filters leave; `includes: false` leaves out what they
    # include (to count the includes among the rest).
    def apply(scope, includes: true)
      scope = search(scope)
      scope = scope.where(cancellation_policy: Listing::FREE_CANCELLATION_POLICIES) if @free_cancellation
      scope = scope.where("listings.attrs->'pets_allowed' = 'true'::jsonb") if @pets
      scope = scope.where("#{PRICE_FROM} >= ?", @min_price) if @min_price
      scope = scope.where("#{PRICE_FROM} <= ?", @max_price) if @max_price
      scope = scope.where(category_id: Category.where(slug: @kinds).select(:id)) if @kinds.any?
      scope = scope.where("listings.attrs->>'transmission' IN (?)", @transmissions) if @transmissions.any?
      FEES.each do |key, column|
        next unless instance_variable_get(:"@#{key}")

        scope = scope.where(id: VehicleRate.where.not(column => nil).select(:listing_id))
      end
      includes ? @includes.reduce(scope) { |each, key| each.where(*include_condition(key)) } : scope
    end

    # The filter sheet's choices over a group's cards (`group`: whose cards, `Cards::STAY_KEY_SQL` or `TITLE_KEY_SQL`), each with
    # how many cards have it: all of them before the filters, but with the search, except what
    # they include, counted among the cards the other filters leave (What to book's way). `cards`
    # counts them, `prices` spans their from-prices (`unpriced`: some have none yet), `shared` is
    # what every listing of two or more cards has (the section's "All have:"), and
    # `unpriced_booking_type` how the first unpriced one is booked (its note on pricing).
    def facets(scope, group)
      sql = "WITH facts AS MATERIALIZED (#{facts(scope, group).to_sql}), #{FACETS_SQL}"
      data = JSON.parse(without_jit { ActiveRecord::Base.connection.select_value(sql) })
      cards = data["cards"].symbolize_keys
      listings = data["listings"].symbolize_keys
      includes = (data["includes"] || []).filter_map { |key, count, _| [ key, count ] if count.positive? }.to_h
      @includes.each { |key| includes[key] ||= 0 }
      {
        **cards.slice(:cards, :free_cancellation, :pets),
        **listings.slice(:price_min_cents, :price_max_cents, :unpriced),
        kinds: (data["kinds"] || []).sort_by { |slug, name, _| [ name, slug ] }.map { |slug, name, count| { value: slug, label: name, count: } },
        transmissions: (data["transmissions"] || []).sort.map { |value, count| { value:, count: } },
        **cards.slice(:delivery, :pickup, :child_helmets),
        includes: includes.sort_by { |key, count| [ -count, key ] }.map { |key, count| { key:, count: } },
        shared: shared(cards[:cards], listings, data["includes"] || []),
        unpriced_booking_type: listings[:unpriced_booking_type]
      }
    end

    private

    def read_flag(key)
      value = @params[key]
      return false if value.nil? || value == ""
      return value if [ true, false ].include?(value)

      flag = value.is_a?(String) ? FLAGS[value] : nil
      @errors << "#{key.to_s.humanize} must be true or false" if flag.nil?
      flag || false
    end

    def read_cents(key)
      value = @params[key]
      return nil if value.nil? || value == ""

      number = value.is_a?(Integer) ? value : (Integer(value, 10, exception: false) if value.is_a?(String))
      return number if number && number >= 0

      @errors << "#{key.to_s.humanize} must be a whole number from 0"
      nil
    end

    def read_list(key)
      value = @params[key]
      return [] if value.nil?
      return value.uniq if value.is_a?(Array) && value.all? { |each| each.is_a?(String) && each.present? }

      @errors << "#{key.to_s.humanize} must be a list of words"
      []
    end

    # The search's words: a plural matches its singular ("scooters" finds a scooter).
    def read_words
      value = @params[:q]
      return [] if value.nil?
      return @errors.push("Q must be text") && [] unless value.is_a?(String)

      value.downcase.split.map { |word| word.length > 3 && word.end_with?("s") ? word.delete_suffix("s") : word }.first(8)
    end

    def include_condition(key)
      kind, value = key.split(":", 2)
      case kind
      when "guide" then [ "listings.attrs->'guide_included' = 'true'::jsonb" ]
      when "licence" then [ "listings.attrs->'licence_required' = 'true'::jsonb" ]
      when "bathroom" then [ "listings.attrs->>'bathroom' = ?", value ]
      when "amenity" then [ "listings.attrs->'amenities' @> ?::jsonb", [ value ].to_json ]
      when "feature" then [ "listings.attrs->'features' @> ?::jsonb", [ value ].to_json ]
      when "accessory"
        [ "listings.attrs->'accessories' @> :one::jsonb OR listings.attrs->'lenses' @> :one::jsonb", { one: [ value ].to_json } ]
      else [ "FALSE" ]
      end
    end

    # One row per listing the search finds: its card and the facts the facets count.
    def facts(scope, group)
      passing = other_filters? ? "listings.id IN (#{apply(scope, includes: false).select(:id).to_sql})" : "TRUE"
      fees = FEES.map { |key, column| "vehicle_rates.#{column} IS NOT NULL AS #{key}" }.join(", ")
      search(scope).joins(:category).left_joins(:vehicle_rate).select(Arel.sql(<<~SQL.squish))
        listings.id, #{group == "stay" ? Cards::STAY_KEY_SQL : Cards::TITLE_KEY_SQL} AS card,
        listings.cancellation_policy AS policy, #{FREE_CANCELLATION_SQL} AS free_cancellation,
        COALESCE(listings.attrs->'pets_allowed' = 'true'::jsonb, false) AS pets, #{ATTR_TEXT.call('transmission')} AS transmission,
        categories.slug, categories.name, categories.booking_type, #{fees}, #{PRICE_FROM} AS price,
        #{passing} AS passing, #{INCLUDES_SQL} AS includes
      SQL
    end

    # Runs the facets' statement with Postgres' JIT off: Postgres guesses ~100 includes per listing,
    # so a 50k-listing place's cost estimate passes jit_above_cost and compiling took ~33 ms of a
    # ~100 ms query (2026-11-11). SET LOCAL ends with the transaction.
    def without_jit
      ActiveRecord::Base.transaction do
        ActiveRecord::Base.connection.execute("SET LOCAL jit = off")
        yield
      end
    end

    # Whether a filter other than the includes is set (else every listing the search finds passes them).
    def other_filters?
      BOOLEANS.any? { |key| instance_variable_get(:"@#{key}") } || @min_price || @max_price || @kinds.any? || @transmissions.any?
    end

    # What every listing has, once there are two cards or more: includes, pets, its cancellation.
    def shared(cards, listings, includes)
      return { includes: [], pets: false, cancellation_policy: nil } if cards < 2

      policy = listings[:policy]
      {
        includes: includes.filter_map { |key, _, count| key if count == listings[:listings] }.sort,
        pets: listings[:pets],
        cancellation_policy: listings[:one_policy] && Listing::FREE_CANCELLATION_POLICIES.include?(policy) ? policy : nil
      }
    end
  end
end
