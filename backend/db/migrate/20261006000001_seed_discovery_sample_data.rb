# Discovery sample data (RAA-33): two test destinations, Bantayan Island and Cebu City
# (under Cebu, under Central Visayas), with real landmarks, an admin-style tag list, the
# category tree and fictional partners and listings, so the team can try search by
# destination, landmark and activity. Coordinates are approximate. Partners are made up
# (@example.com, no password, so nobody can sign in as them).
#
# This runs everywhere a migration runs, production included. `down` removes exactly
# these rows; a later migration can do the same once real data replaces them.
class SeedDiscoverySampleData < ActiveRecord::Migration[8.1]
  # A JSON Schema object with typed properties, for the category list below.
  def self.object(required, **types)
    properties = types.transform_values do |type|
      type == "array" ? { type: "array", items: { type: "string" } } : { type: }
    end
    { type: "object", properties:, required: }
  end

  AREAS = [
    # slug, parent, kind, name, aliases, center (lon lat)
    [ "central-visayas", nil, "region", "Central Visayas", [ "Region VII" ], "123.90 10.30" ],
    [ "cebu", "central-visayas", "province", "Cebu", [ "Cebu Province", "Sugbo" ], "123.85 10.45" ],
    [ "bantayan-island", "cebu", "island", "Bantayan Island", [ "Bantayan", "Santa Fe", "Madridejos" ], "123.75 11.20" ],
    [ "cebu-city", "cebu", "city", "Cebu City", [ "Queen City of the South", "Sugbo City" ], "123.8854 10.3157" ]
  ].freeze

  TAGS = [
    # slug, kind, name, aliases
    [ "swimming", "activity", "Swimming", [ "swim" ] ],
    [ "snorkelling", "activity", "Snorkelling", [ "snorkeling", "snorkel" ] ],
    [ "island-hopping", "activity", "Island hopping", [ "boat tour", "island tour" ] ],
    [ "cliff-diving", "activity", "Cliff diving", [ "cliff jumping" ] ],
    [ "freediving", "activity", "Freediving", [ "free diving" ] ],
    [ "sightseeing", "activity", "Sightseeing", [ "city tour", "land tour" ] ],
    [ "hiking", "activity", "Hiking", [ "trekking" ] ],
    [ "photography", "activity", "Photography", [ "photoshoot", "photo spot" ] ],
    [ "biking", "activity", "Biking", [ "cycling", "bike" ] ],
    [ "sunset-viewing", "activity", "Sunset viewing", [ "sunset" ] ],
    [ "white-sand", "feature", "White sand", [ "white beach", "white sand beach" ] ],
    [ "sandbar", "feature", "Sandbar", [] ],
    [ "cave-pool", "feature", "Cave pool", [ "cave swimming" ] ],
    [ "viewpoint", "feature", "Viewpoint", [ "view deck", "lookout" ] ],
    [ "flower-garden", "feature", "Flower garden", [ "flowers" ] ],
    [ "history", "theme", "History", [ "heritage", "historical" ] ],
    [ "religious", "theme", "Religious sites", [ "church", "pilgrimage", "temple" ] ],
    [ "architecture", "theme", "Architecture", [] ],
    [ "culture", "theme", "Culture", [ "museum" ] ]
  ].freeze

  LANDMARKS = [
    # slug, area, name, aliases, location (lon lat), status, tags, description
    [ "kota-beach", "bantayan-island", "Kota Beach", [ "Santa Fe beach" ], "123.7994 11.1735", "published",
      %w[swimming white-sand sandbar sunset-viewing],
      "White-sand beach in Santa Fe whose sandbar changes shape with the tide." ],
    [ "paradise-beach", "bantayan-island", "Paradise Beach", [], "123.8106 11.1950", "published",
      %w[swimming white-sand snorkelling],
      "Quiet white-sand cove north of Santa Fe town with clear, shallow water." ],
    [ "virgin-island", "bantayan-island", "Virgin Island", [ "Silion Island" ], "123.8470 11.1500", "published",
      %w[island-hopping snorkelling cliff-diving swimming white-sand],
      "Islet off Santa Fe with powdery sand, cliff-diving spots and clear water for snorkelling." ],
    [ "hilantagaan-island", "bantayan-island", "Hilantagaan Island", [ "Hilantagaan" ], "123.8770 11.2060", "published",
      %w[island-hopping snorkelling cliff-diving freediving],
      "Fishing-village island east of Santa Fe, known for its reef and cliff jumps." ],
    [ "ogtong-cave", "bantayan-island", "Ogtong Cave", [], "123.8065 11.1849", "published",
      %w[cave-pool swimming],
      "Underground cave with a natural seawater pool, open for swimming inside a Santa Fe resort." ],
    [ "kota-park", "bantayan-island", "Kota Park", [ "Kota Heritage Park" ], "123.7235 11.2690", "published",
      %w[history sightseeing],
      "Ruins of a coral-stone fort in Madridejos, built around 1790 against raids." ],
    [ "madridejos-lighthouse", "bantayan-island", "Madridejos Lighthouse", [ "Bontay Boardwalk" ], "123.7180 11.2710",
      "published", %w[sightseeing sunset-viewing viewpoint photography],
      "Lighthouse at the end of the Bontay Boardwalk, a sunset spot on the island's north tip." ],
    [ "sts-peter-and-paul-church", "bantayan-island", "Sts. Peter and Paul Church", [ "Bantayan Church" ],
      "123.7213 11.1680", "published", %w[history religious architecture],
      "Coral-stone parish church in Bantayan town; the parish dates from 1580." ],
    [ "obo-ob-mangrove-garden", "bantayan-island", "Obo-ob Mangrove Garden", [], "123.7420 11.2550", "draft",
      %w[sightseeing],
      "Mangrove boardwalk in Madridejos. Draft: not shown to guests yet." ],
    [ "magellans-cross", "cebu-city", "Magellan's Cross", [ "Magellan Cross" ], "123.9020 10.2936", "published",
      %w[history religious sightseeing],
      "Cross planted by Magellan's expedition in 1521, housed in a kiosk beside the Basilica." ],
    [ "basilica-del-santo-nino", "cebu-city", "Basilica Minore del Santo Niño", [ "Santo Nino Church", "Basilica" ],
      "123.9017 10.2943", "published", %w[religious history architecture],
      "16th-century basilica housing the Santo Niño, the oldest Christian relic in the Philippines." ],
    [ "fort-san-pedro", "cebu-city", "Fort San Pedro", [], "123.9055 10.2925", "published",
      %w[history architecture sightseeing],
      "The oldest and smallest triangular bastion fort in the Philippines, begun in 1565." ],
    [ "taoist-temple", "cebu-city", "Taoist Temple", [], "123.8823 10.3326", "published",
      %w[religious architecture viewpoint],
      "Temple in Beverly Hills, Lahug, with dragon-lined stairs and a view over the city." ],
    [ "temple-of-leah", "cebu-city", "Temple of Leah", [], "123.8717 10.3731", "published",
      %w[architecture viewpoint photography],
      "Roman-style temple in the Busay hills, built as a monument to love." ],
    [ "sirao-flower-garden", "cebu-city", "Sirao Flower Garden", [ "Little Amsterdam", "Sirao Garden" ],
      "123.8693 10.4000", "published", %w[flower-garden photography],
      "Highland garden of celosia and other blooms, known as the Little Amsterdam of Cebu." ],
    [ "tops-lookout", "cebu-city", "Tops Lookout", [ "Tops", "Busay" ], "123.8653 10.3714", "published",
      %w[viewpoint sunset-viewing sightseeing photography],
      "Mountain-top deck about 600 m up in Busay with a view of the city and Mactan." ],
    [ "museo-sugbo", "cebu-city", "Museo Sugbo", [ "Cebu Provincial Museum" ], "123.9068 10.2991", "published",
      %w[history culture],
      "Provincial museum in a former 19th-century jail, covering Cebu from pre-colonial times." ]
  ].freeze

  CATEGORIES = [
    # slug, parent, name, booking_type, attribute_schema
    [ "services", nil, "Services", nil, {} ],
    [ "tour", "services", "Tour", "activity",
      object(%w[guide_included], guide_included: "boolean", life_vests: "boolean", duration_hours: "number",
        max_group: "integer") ],
    [ "photographer", "services", "Photographer", "activity",
      object(%w[hours], hours: "integer", edited_photos: "integer") ],
    [ "accommodation", nil, "Accommodation", nil, {} ],
    [ "hotel", "accommodation", "Hotel or cottage", "stay",
      object(%w[guests], guests: "integer", amenities: "array") ],
    [ "rentals", nil, "Rentals", nil, {} ],
    [ "motorcycle", "rentals", "Motorcycle", "rental",
      object(%w[helmet_included], plate_no: "string", helmet_included: "boolean") ],
    [ "bicycle", "rentals", "Bicycle", "rental", object([], bike_type: "string", helmet_included: "boolean") ],
    [ "e-trike", "rentals", "E-trike", "rental", object(%w[seats], seats: "integer", driver_included: "boolean") ],
    [ "action-camera", "rentals", "Action camera", "rental",
      object([], serial_no: "string", accessories: "array") ],
    [ "camera", "rentals", "Camera", "rental", object([], serial_no: "string", lenses: "array") ],
    [ "snorkel-gear", "rentals", "Snorkel gear", "rental", object(%w[sizes], sizes: "array") ],
    [ "transport", nil, "Transport", nil, {} ],
    [ "van", "transport", "Van transfer", "transfer",
      object(%w[seats], seats: "integer", luggage: "integer", route: "string") ]
  ].freeze

  # How much a category helps with a tag, 1-3. Stays and transfers are always suggested,
  # so they have none.
  CATEGORY_TAGS = {
    "action-camera" => { "snorkelling" => 3, "freediving" => 3, "cliff-diving" => 3, "island-hopping" => 2, "swimming" => 2 },
    "snorkel-gear" => { "snorkelling" => 3, "freediving" => 3, "swimming" => 2, "island-hopping" => 2 },
    "tour" => { "island-hopping" => 3, "sightseeing" => 3, "history" => 2, "hiking" => 2, "snorkelling" => 1 },
    "photographer" => { "photography" => 3, "white-sand" => 2, "sunset-viewing" => 2, "flower-garden" => 2, "architecture" => 1 },
    "camera" => { "photography" => 3, "viewpoint" => 2, "architecture" => 2, "history" => 2, "religious" => 1 },
    "motorcycle" => { "sightseeing" => 2, "viewpoint" => 2 },
    "bicycle" => { "biking" => 3, "sightseeing" => 1 },
    "e-trike" => { "sightseeing" => 2 }
  }.freeze

  PARTNERS = [
    # email, name
    [ "santa-fe-scooters@example.com", "Santa Fe Scooters & Bikes" ],
    [ "kota-beach-boat-tours@example.com", "Kota Beach Boat Tours" ],
    [ "bantayan-dive-shack@example.com", "Bantayan Dive Shack" ],
    [ "santa-fe-beach-cottages@example.com", "Santa Fe Beach Cottages" ],
    [ "island-shuttle@example.com", "Island Shuttle Co." ],
    [ "sugbo-heritage-walks@example.com", "Sugbo Heritage Walks" ],
    [ "busay-highland-rides@example.com", "Busay Highland Rides" ],
    [ "colon-street-lens@example.com", "Colon Street Lens Rentals" ],
    [ "fuente-pension-house@example.com", "Fuente Pension House" ]
  ].freeze

  LISTINGS = [
    # partner email, area, category, title, location (lon lat), status, attrs, landmarks visited, description
    [ "kota-beach-boat-tours@example.com", "bantayan-island", "tour", "Virgin Island and Hilantagaan island hopping",
      "123.8010 11.1720", "active",
      { guide_included: true, life_vests: true, duration_hours: 5, max_group: 12 },
      %w[virgin-island hilantagaan-island],
      "Joiner boat tour from Santa Fe: snorkelling at Hilantagaan, cliff diving and lunch on Virgin Island." ],
    [ "santa-fe-scooters@example.com", "bantayan-island", "motorcycle", "Honda Click 125 scooter",
      "123.8030 11.1580", "active", { plate_no: "BTN 4521", helmet_included: true }, [],
      "Automatic scooter for getting around the island; two helmets included." ],
    [ "santa-fe-scooters@example.com", "bantayan-island", "bicycle", "Mountain bike",
      "123.8030 11.1580", "active", { bike_type: "mountain", helmet_included: true }, [],
      "21-speed bike for the flat coastal roads between Santa Fe and Bantayan town." ],
    [ "santa-fe-scooters@example.com", "bantayan-island", "e-trike", "E-trike island tour with driver",
      "123.8030 11.1580", "active", { seats: 4, driver_included: true },
      %w[kota-park madridejos-lighthouse sts-peter-and-paul-church],
      "Half-day land tour: Bantayan church, Kota Park and the Madridejos lighthouse." ],
    [ "bantayan-dive-shack@example.com", "bantayan-island", "snorkel-gear", "Fins, mask and snorkel set",
      "123.8000 11.1700", "active", { sizes: %w[S M L] }, [],
      "Full snorkel set for a day of beach and island hopping." ],
    [ "bantayan-dive-shack@example.com", "bantayan-island", "action-camera", "GoPro Hero 12 with dive housing",
      "123.8000 11.1700", "active", { serial_no: "GP12-0107", accessories: [ "dive housing", "floaty" ] }, [],
      "Film the reef and the cliff jumps; housing rated to 60 m." ],
    [ "santa-fe-beach-cottages@example.com", "bantayan-island", "hotel", "Beachfront nipa cottage, Santa Fe",
      "123.8015 11.1690", "active", { guests: 2, amenities: %w[fan wifi breakfast] }, [],
      "Native-style cottage a few steps from Kota Beach." ],
    [ "island-shuttle@example.com", "bantayan-island", "van", "Hagnaya port to Santa Fe van transfer",
      "123.8030 11.1600", "active", { seats: 12, luggage: 10, route: "Hagnaya port (San Remigio) to Santa Fe" }, [],
      "Meets the ferry from Hagnaya and drops you at your Santa Fe hotel." ],
    [ "kota-beach-boat-tours@example.com", "bantayan-island", "photographer", "Sunset photoshoot at Kota Beach",
      "123.7994 11.1735", "active", { hours: 1, edited_photos: 30 }, %w[kota-beach],
      "One-hour golden-hour shoot on the sandbar, 30 edited photos." ],
    [ "bantayan-dive-shack@example.com", "bantayan-island", "photographer", "Drone photo package",
      "123.8000 11.1700", "pending", { hours: 2, edited_photos: 20 }, [],
      "Pending admin approval: not shown to guests yet." ],
    [ "sugbo-heritage-walks@example.com", "cebu-city", "tour", "Cebu heritage walking tour",
      "123.9020 10.2936", "active", { guide_included: true, duration_hours: 3, max_group: 15 },
      %w[magellans-cross basilica-del-santo-nino fort-san-pedro museo-sugbo],
      "Guided walk through the old city: Magellan's Cross, the Basilica, Fort San Pedro and Museo Sugbo." ],
    [ "busay-highland-rides@example.com", "cebu-city", "tour", "Tops, Temple of Leah and Sirao highland tour",
      "123.8800 10.3400", "active", { guide_included: true, duration_hours: 5, max_group: 4 },
      %w[tops-lookout temple-of-leah sirao-flower-garden],
      "Private car up to the Busay hills: Sirao garden, Temple of Leah and sunset at Tops." ],
    [ "island-shuttle@example.com", "cebu-city", "van", "Mactan airport to Cebu City van transfer",
      "123.9000 10.3100", "active", { seats: 10, luggage: 8, route: "Mactan-Cebu International Airport to Cebu City" },
      [], "Private van from the airport to any Cebu City hotel." ],
    [ "colon-street-lens@example.com", "cebu-city", "camera", "Sony A7 IV with 24-70mm lens",
      "123.8990 10.2960", "active", { serial_no: "SA7-2219", lenses: [ "24-70mm f/2.8" ] }, [],
      "Full-frame mirrorless kit for the heritage sites and the city view from Tops." ],
    [ "colon-street-lens@example.com", "cebu-city", "action-camera", "Insta360 X4",
      "123.8990 10.2960", "active", { serial_no: "IX4-0031", accessories: [ "invisible selfie stick" ] }, [],
      "360-degree camera for walking tours and rides." ],
    [ "colon-street-lens@example.com", "cebu-city", "photographer", "Sirao garden portrait session",
      "123.8693 10.4000", "active", { hours: 2, edited_photos: 40 }, %w[sirao-flower-garden],
      "Two-hour portrait session among the celosia fields." ],
    [ "busay-highland-rides@example.com", "cebu-city", "motorcycle", "Honda Click 125 scooter",
      "123.8850 10.3300", "active", { plate_no: "CEB 7781", helmet_included: true }, [],
      "Scooter for the ride up to Busay; two helmets included." ],
    [ "fuente-pension-house@example.com", "cebu-city", "hotel", "Twin room near Fuente Circle",
      "123.8920 10.3110", "active", { guests: 2, amenities: %w[aircon wifi] }, [],
      "Simple air-conditioned room, ten minutes from the heritage district." ]
  ].freeze

  def up
    AREAS.each do |slug, parent, kind, name, aliases, center|
      insert "areas", { slug:, kind:, name:, aliases: array(aliases), center: point(center),
        parent_id: parent && raw("(SELECT id FROM areas WHERE slug = #{quote(parent)})") }
    end

    TAGS.each do |slug, kind, name, aliases|
      insert "tags", { slug:, kind:, name:, aliases: array(aliases) }
    end

    LANDMARKS.each do |slug, area, name, aliases, location, status, tags, description|
      insert "landmarks", { slug:, name:, status:, description:, aliases: array(aliases), location: point(location),
        area_id: id_of("areas", area) }
      tags.each do |tag|
        insert "landmark_tags", { landmark_id: id_of("landmarks", slug), tag_id: id_of("tags", tag) }, timestamps: false
      end
    end

    CATEGORIES.each do |slug, parent, name, booking_type, schema|
      insert "categories", { slug:, name:, booking_type:, attribute_schema: schema.to_json,
        parent_id: parent && id_of("categories", parent) }
    end
    CATEGORY_TAGS.each do |category, weights|
      weights.each do |tag, weight|
        insert "category_tags", { category_id: id_of("categories", category), tag_id: id_of("tags", tag), weight: },
          timestamps: false
      end
    end

    PARTNERS.each do |email, name|
      insert "users", { email:, name:, role: "partner" }
    end

    LISTINGS.each do |email, area, category, title, location, status, attrs, landmarks, description|
      insert "listings", { title:, status:, description:, attrs: attrs.to_json, location: point(location),
        partner_id: raw(partner_id(email)),
        area_id: id_of("areas", area), category_id: id_of("categories", category) }
      landmarks.each do |landmark|
        insert "listing_landmarks", {
          listing_id: raw("(SELECT id FROM listings WHERE title = #{quote(title)} AND partner_id = #{partner_id(email)})"),
          landmark_id: id_of("landmarks", landmark), relation: "visits"
        }, timestamps: false
      end
    end
  end

  def down
    partner_ids = "SELECT id FROM users WHERE role = 'partner' AND email IN (#{list(PARTNERS.map(&:first))})"
    execute "DELETE FROM listing_landmarks WHERE listing_id IN (SELECT id FROM listings WHERE partner_id IN (#{partner_ids}))"
    execute "DELETE FROM listings WHERE partner_id IN (#{partner_ids})"
    execute "DELETE FROM users WHERE id IN (#{partner_ids})"

    category_slugs = list(CATEGORIES.map(&:first))
    execute "DELETE FROM category_tags WHERE category_id IN (SELECT id FROM categories WHERE slug IN (#{category_slugs}))"
    execute "DELETE FROM categories WHERE parent_id IS NOT NULL AND slug IN (#{category_slugs})"
    execute "DELETE FROM categories WHERE slug IN (#{category_slugs})"

    landmark_slugs = list(LANDMARKS.map(&:first))
    execute "DELETE FROM landmark_tags WHERE landmark_id IN (SELECT id FROM landmarks WHERE slug IN (#{landmark_slugs}))"
    execute "DELETE FROM landmarks WHERE slug IN (#{landmark_slugs})"
    execute "DELETE FROM tags WHERE slug IN (#{list(TAGS.map(&:first))})"

    # Children before parents.
    AREAS.reverse_each { |slug, *| execute "DELETE FROM areas WHERE slug = #{quote(slug)}" }
  end

  private

  Raw = Struct.new(:sql)

  def raw(sql) = Raw.new(sql)

  def insert(table, values, timestamps: true)
    values = values.merge(created_at: raw("now()"), updated_at: raw("now()")) if timestamps
    sql_values = values.values.map { |value| value.is_a?(Raw) ? value.sql : quote(value) }
    execute "INSERT INTO #{table} (#{values.keys.join(', ')}) VALUES (#{sql_values.join(', ')})"
  end

  def partner_id(email)
    "(SELECT id FROM users WHERE email = #{quote(email)} AND role = 'partner')"
  end

  def id_of(table, slug)
    raw("(SELECT id FROM #{table} WHERE slug = #{quote(slug)})")
  end

  def point(lon_lat)
    raw("ST_GeogFromText(#{quote("SRID=4326;POINT(#{lon_lat})")})")
  end

  def array(values)
    raw("ARRAY[#{values.map { |value| quote(value) }.join(', ')}]::varchar[]")
  end

  def list(values)
    values.map { |value| quote(value) }.join(", ")
  end

  def quote(value)
    connection.quote(value)
  end
end
