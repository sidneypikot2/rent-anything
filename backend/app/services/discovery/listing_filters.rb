module Discovery
  # A guest's filters on one group of listings, as What to book and the plan's steps offer them
  # (2026-11-10): free cancellation, pet-friendly stays, a price range on the "from" price, a
  # rental's vehicle (its category), transmission, drop-off, pick-up at the end and child helmets,
  # what the listings include, and a search. Read from the request (`errors` for a 422), applied
  # in SQL listing by listing (a card keeps only its listings that pass), and counted for the
  # filter sheet (`facets`), in cards. Includes are keys; the web app words them (its chips'
  # labels): `guide`, `licence`, `bathroom:<kind>`, `amenity:<name>`, `accessory:<name>` (an
  # accessory or a lens) and `feature:<name>` (a jet ski's).
  class ListingFilters
    FLAGS = { "true" => true, "1" => true, "false" => false, "0" => false }.freeze
    BOOLEANS = %i[free_cancellation pets delivery pickup child_helmets].freeze
    LISTS = %i[kinds transmissions includes].freeze
    # The request's keys, all optional.
    PARAMS = [ *BOOLEANS, :min_price_cents, :max_price_cents, *LISTS, :q ].freeze
    # A rental's handover, by the fee its rate sets (nil: not offered).
    FEES = { delivery: "delivery_fee_cents", pickup: "return_pickup_fee_cents", child_helmets: "child_helmet_fee_cents" }.freeze
    # A listing's from-price in SQL: PricingSerializer.price_from_cents's order (keep the two in
    # step) — a stay's nightly price, a vehicle's daily one, a flat price, a tour's base price, a
    # water activity's cheapest current offer; null while it has none.
    PRICE_FROM = <<~SQL.squish.freeze
      COALESCE(
        (SELECT NULLIF(stay_rates.nightly_price_cents, 0) FROM stay_rates WHERE stay_rates.listing_id = listings.id),
        (SELECT NULLIF(vehicle_rates.daily_price_cents, 0) FROM vehicle_rates WHERE vehicle_rates.listing_id = listings.id),
        (SELECT NULLIF(flat_rates.price_cents, 0) FROM flat_rates WHERE flat_rates.listing_id = listings.id),
        (SELECT NULLIF(tour_details.base_price_cents, 0) FROM tour_details WHERE tour_details.listing_id = listings.id),
        (SELECT MIN(activity_offers.price_cents) FROM activity_offers
          WHERE activity_offers.listing_id = listings.id AND activity_offers.archived_at IS NULL
            AND EXISTS (SELECT 1 FROM activity_details WHERE activity_details.listing_id = listings.id))
      )
    SQL
    # What a search reads: the title, its kind, who offers it, where, and its description.
    SEARCH_TEXT = <<~SQL.squish.freeze
      CONCAT_WS(' ', listings.title, categories.name, businesses.name, areas.name, listings.description)
    SQL
    # Facts a facet needs, per listing (`facts`).
    FACT_KEYS = %w[guide_included licence_required bathroom amenities accessories lenses features pets_allowed transmission].freeze

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
      rows = facts(search(scope), group)
      passing = apply(scope, includes: false).pluck(:id).to_set
      cards = rows.group_by { |row| row[:card] }
      having = ->(&test) { cards.count { |_, listings| listings.any?(&test) } }
      kinds = rows.group_by { |row| [ row[:kind], row[:kind_name] ] }.keys.sort_by(&:last)
      prices = rows.filter_map { |row| row[:price] }
      {
        cards: cards.size,
        free_cancellation: having.call { |row| Listing::FREE_CANCELLATION_POLICIES.include?(row[:policy]) },
        pets: having.call { |row| row[:pets] },
        price_min_cents: prices.min,
        price_max_cents: prices.max,
        unpriced: rows.any? { |row| row[:price].nil? },
        kinds: kinds.map { |slug, name| { value: slug, label: name, count: having.call { |row| row[:kind] == slug } } },
        transmissions: rows.filter_map { |row| row[:transmission] }.uniq.sort
          .map { |value| { value:, count: having.call { |row| row[:transmission] == value } } },
        delivery: having.call { |row| row[:delivery] },
        pickup: having.call { |row| row[:pickup] },
        child_helmets: having.call { |row| row[:child_helmets] },
        includes: include_counts(cards, passing),
        shared: shared(cards, rows),
        unpriced_booking_type: rows.find { |row| row[:price].nil? }&.dig(:booking_type)
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

    # What a listing includes, as keys (the chips the web app offers under Includes).
    def include_keys(attrs)
      list = ->(key) { Array(attrs[key]).map(&:to_s).reject(&:blank?) }
      [
        ("guide" if attrs["guide_included"] == true),
        ("licence" if attrs["licence_required"] == true),
        ("bathroom:#{attrs['bathroom']}" if attrs["bathroom"].is_a?(String) && attrs["bathroom"].present?),
        *list.call("amenities").map { "amenity:#{_1}" },
        *(list.call("accessories") + list.call("lenses")).map { "accessory:#{_1}" },
        *list.call("features").map { "feature:#{_1}" }
      ].compact.uniq
    end

    # One row per listing: its card and the facts the facets count.
    def facts(scope, group)
      columns = [
        "listings.id", Arel.sql(group == "stay" ? Cards::STAY_KEY_SQL : Cards::TITLE_KEY_SQL), "listings.cancellation_policy",
        Arel.sql("listings.attrs"), "categories.slug", "categories.name", "categories.booking_type",
        *FEES.values.map { |column| Arel.sql("vehicle_rates.#{column} IS NOT NULL") }, Arel.sql(PRICE_FROM)
      ]
      scope.joins(:category).left_joins(:vehicle_rate).pluck(*columns).map do |id, card, policy, attrs, slug, name, type, delivery, pickup, helmets, price|
        attrs = attrs.is_a?(String) ? JSON.parse(attrs) : attrs.to_h
        { id:, card:, policy:, kind: slug, kind_name: name, booking_type: type, price:, delivery:, pickup:, child_helmets: helmets,
          pets: attrs["pets_allowed"] == true,
          transmission: attrs["transmission"].is_a?(String) && attrs["transmission"].present? ? attrs["transmission"] : nil,
          includes: include_keys(attrs) }
      end
    end

    # Each include with how many cards have it among their listings the other filters leave; one
    # already picked stays listed with 0.
    def include_counts(cards, passing)
      counts = Hash.new(0)
      cards.each_value do |listings|
        listings.select { |row| passing.include?(row[:id]) }.flat_map { |row| row[:includes] }.uniq.each { |key| counts[key] += 1 }
      end
      @includes.each { |key| counts[key] += 0 }
      counts.sort_by { |key, count| [ -count, key ] }.map { |key, count| { key:, count: } }
    end

    # What every listing has, once there are two cards or more: includes, pets, its cancellation.
    def shared(cards, rows)
      return { includes: [], pets: false, cancellation_policy: nil } if cards.size < 2

      policies = rows.map { |row| row[:policy] }.uniq
      {
        includes: rows.map { |row| row[:includes] }.reduce(:&),
        pets: rows.all? { |row| row[:pets] },
        cancellation_policy: policies.one? && Listing::FREE_CANCELLATION_POLICIES.include?(policies.first) ? policies.first : nil
      }
    end
  end
end
