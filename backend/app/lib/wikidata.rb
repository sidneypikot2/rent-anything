# Wikidata (CC0) and Wikimedia pageviews, read by `rails gazetteer:wikidata` (RAA-62) for
# extra search terms and a starting popularity. Never called while a guest searches.
# APIs: query.wikidata.org (SPARQL) and wikimedia.org/api/rest_v1 (pageviews); both ask
# for a User-Agent that says who is calling.
module Wikidata
  SPARQL_URL = "https://query.wikidata.org/sparql".freeze
  PAGEVIEWS_URL = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user".freeze
  USER_AGENT = "RentAnything/1.0 (https://github.com/sidneypikot2/rent-anything; gazetteer:wikidata)".freeze
  LANGUAGES = %w[en tl ceb].freeze
  PSGC_PROPERTY = "P988".freeze
  COORDINATES_PROPERTY = "P625".freeze
  # Tries per request when rate-limited (429) or briefly down (503), and the longest wait.
  ATTEMPTS = 4
  MAX_PAUSE = 60

  # Wikidata couldn't be reached or answered with something unusable.
  class Error < StandardError; end

  # Items with this PSGC code. Wikidata keeps the old 9-digit code (Naga, Cebu: 072234000).
  def self.find_by_psgc(code)
    raise ArgumentError, "not a 9-digit PSGC code: #{code.inspect}" unless code.to_s.match?(/\A\d{9}\z/)

    item_ids(sparql(<<~SPARQL))
      SELECT DISTINCT ?item WHERE { ?item wdt:#{PSGC_PROPERTY} "#{code}" . }
    SPARQL
  end

  # Items within radius_km of the point with this name as a label or alias, ignoring case.
  def self.find_near(name:, lat:, lng:, radius_km:)
    item_ids(sparql(<<~SPARQL))
      SELECT DISTINCT ?item WHERE {
        SERVICE wikibase:around {
          ?item wdt:#{COORDINATES_PROPERTY} ?location .
          bd:serviceParam wikibase:center "Point(#{Float(lng)} #{Float(lat)})"^^geo:wktLiteral ;
                          wikibase:radius "#{Float(radius_km)}" .
        }
        ?item rdfs:label|skos:altLabel ?label .
        FILTER(LANG(?label) IN (#{language_list}) && LCASE(STR(?label)) = #{literal(name.downcase)})
      }
    SPARQL
  end

  # { "Q123" => { terms: [labels and aliases in LANGUAGES], sitelinks: Integer, enwiki: title or nil } }
  def self.entities(ids)
    ids.each { |id| raise ArgumentError, "not a Wikidata item: #{id.inspect}" unless id.to_s.match?(/\AQ\d+\z/) }
    return {} if ids.empty?

    rows = sparql(<<~SPARQL)
      SELECT ?item ?sitelinks ?article ?label WHERE {
        VALUES ?item { #{ids.map { |id| "wd:#{id}" }.join(" ")} }
        ?item wikibase:sitelinks ?sitelinks .
        OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
        OPTIONAL { ?item rdfs:label|skos:altLabel ?label . FILTER(LANG(?label) IN (#{language_list})) }
      }
    SPARQL
    rows.group_by { |row| item_id(row) }.transform_values do |item_rows|
      article = item_rows.filter_map { |row| row.dig("article", "value") }.first
      {
        terms: item_rows.filter_map { |row| row.dig("label", "value") }.uniq,
        sitelinks: Integer(item_rows.first.dig("sitelinks", "value").to_s, exception: false) ||
          raise(Error, "Wikidata answered with something unexpected"),
        enwiki: article && URI.decode_www_form_component(article.split("/wiki/", 2).last)
      }
    end
  end

  # Average monthly views of the English Wikipedia article over the last 12 full months;
  # 0 when it has none.
  def self.monthly_pageviews(title, today: Date.current)
    last = today.beginning_of_month.prev_month
    path = "#{ERB::Util.url_encode(title.tr(" ", "_"))}/monthly/#{(last << 11).strftime("%Y%m%d")}/#{last.strftime("%Y%m%d")}"
    body = get(URI("#{PAGEVIEWS_URL}/#{path}"), not_found: { "items" => [] })
    views = Array(body["items"]).map { |item| item["views"] if item.is_a?(Hash) }
    raise Error, "Wikimedia pageviews answered with something unexpected" unless views.all?(Integer)

    views.empty? ? 0 : views.sum / views.size
  end

  def self.sparql(query)
    uri = URI(SPARQL_URL)
    uri.query = URI.encode_www_form(query: query, format: "json")
    get(uri).dig("results", "bindings") || raise(Error, "Wikidata answered with something unexpected")
  end

  def self.get(uri, not_found: nil)
    request = Net::HTTP::Get.new(uri)
    request["User-Agent"] = USER_AGENT
    request["Accept"] = "application/json"
    response = nil
    1.upto(ATTEMPTS) do |attempt|
      response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 30) do |http|
        http.request(request)
      end
      break unless response.is_a?(Net::HTTPTooManyRequests) || response.is_a?(Net::HTTPServiceUnavailable)
      break if attempt == ATTEMPTS

      # Both services ask clients to back off as told by Retry-After.
      pause(response["Retry-After"].to_s.match?(/\A\d+\z/) ? [ response["Retry-After"].to_i, MAX_PAUSE ].min : 2**attempt)
    end
    return not_found if not_found && response.is_a?(Net::HTTPNotFound)
    raise Error, "#{uri.host} answered #{response.code}" unless response.is_a?(Net::HTTPSuccess)

    parsed = JSON.parse(response.body)
    parsed.is_a?(Hash) ? parsed : raise(Error, "#{uri.host} answered with something unexpected")
  rescue JSON::ParserError, SocketError, SystemCallError, IOError, Net::OpenTimeout, Net::ReadTimeout,
    Net::WriteTimeout, Net::HTTPBadResponse, OpenSSL::SSL::SSLError => e
    raise Error, "#{uri.host} request failed (#{e.class})"
  end

  def self.pause(seconds)
    sleep(seconds)
  end

  def self.item_ids(rows)
    rows.map { |row| item_id(row) }.uniq
  end

  def self.item_id(row)
    row.dig("item", "value").to_s.delete_prefix("http://www.wikidata.org/entity/")
  end

  def self.language_list
    LANGUAGES.map { |language| %("#{language}") }.join(", ")
  end

  # A SPARQL string literal; JSON's escapes are valid SPARQL escapes.
  def self.literal(text)
    text.to_json
  end
  private_class_method :sparql, :get, :pause, :item_ids, :item_id, :language_list, :literal
end
