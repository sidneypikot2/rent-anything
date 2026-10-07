# Santa Fe sample partner (RAA-51): a Santa Fe town area under Bantayan Island (Central
# Visayas > Cebu > Bantayan Island > Santa Fe) and one fictional, ID-verified partner with
# 20 active listings there, two in each bookable category, so the team can browse a full
# town. Builds on the RAA-33 sample data (areas, categories, landmarks). The partner is made
# up (@example.com, no password, so nobody can sign in as them) and its verification is
# approved without a Didit session. Coordinates are approximate.
#
# This runs everywhere a migration runs, production included. `down` removes exactly
# these rows.
class SeedSantaFeSamplePartner < ActiveRecord::Migration[8.1]
  EMAIL = "santa-fe-adventures@example.com".freeze

  ADDRESS = { city: "Santa Fe", province: "Cebu", region: "Central Visayas", postal_code: "6047",
    country: "PH" }.freeze

  LISTINGS = [
    # category, title, street, location (lon lat), attrs, landmarks visited, description
    [ "tour", "Virgin Island hopping and snorkelling", "Kota Beach Road, Talisay", "123.7995 11.1730",
      { guide_included: true, life_vests: true, duration_hours: 5, max_group: 10 },
      %w[virgin-island hilantagaan-island],
      "Small-group boat tour from Kota Beach: reef snorkelling off Hilantagaan and lunch on Virgin Island." ],
    [ "tour", "Santa Fe caves and beaches half-day tour", "Poblacion, Santa Fe", "123.8005 11.1585",
      { guide_included: true, duration_hours: 4, max_group: 6 },
      %w[ogtong-cave paradise-beach kota-beach],
      "A swim in the Ogtong cave pool, then Paradise Beach and the Kota Beach sandbar." ],
    [ "photographer", "Kota Beach sunset photoshoot", "Kota Beach Road, Talisay", "123.7994 11.1735",
      { hours: 1, edited_photos: 30 }, %w[kota-beach],
      "Golden-hour shoot on the sandbar, 30 edited photos sent the next day." ],
    [ "photographer", "Island-hopping photographer", "Poblacion, Santa Fe", "123.8005 11.1585",
      { hours: 4, edited_photos: 60 }, %w[virgin-island],
      "A photographer joins your boat for the day: cliff jumps, sandbars and group shots." ],
    [ "hotel", "Beachfront bamboo cottage", "Kota Beach Road, Talisay", "123.8010 11.1715",
      { guests: 2, amenities: %w[fan wifi breakfast] }, [],
      "Native bamboo cottage a few steps from the water at Kota Beach." ],
    [ "hotel", "Family room near the pier", "Santa Fe Port Road, Poblacion", "123.8040 11.1560",
      { guests: 4, amenities: %w[aircon wifi hot-shower] }, [],
      "Air-conditioned room for four, a short walk from the Santa Fe ferry pier." ],
    [ "motorcycle", "Honda Click 125 scooter", "Poblacion, Santa Fe", "123.8005 11.1585",
      { plate_no: "SFE 1021", helmet_included: true }, [],
      "Automatic scooter for the island's coastal roads; two helmets included." ],
    [ "motorcycle", "Yamaha XTZ 125 trail bike", "Poblacion, Santa Fe", "123.8005 11.1585",
      { plate_no: "SFE 3307", helmet_included: true }, [],
      "Manual trail bike for the back roads to Madridejos; helmet included." ],
    [ "bicycle", "Beach cruiser bike", "Kota Beach Road, Talisay", "123.7995 11.1730",
      { bike_type: "cruiser", helmet_included: false }, [],
      "Easy-riding cruiser with a basket for beach-to-town trips." ],
    [ "bicycle", "Mountain bike", "Poblacion, Santa Fe", "123.8005 11.1585",
      { bike_type: "mountain", helmet_included: true }, [],
      "21-speed bike for the flat ride from Santa Fe to Bantayan town." ],
    [ "e-trike", "E-trike town tour with driver", "Poblacion, Santa Fe", "123.8005 11.1585",
      { seats: 4, driver_included: true }, %w[ogtong-cave paradise-beach],
      "Half-day ride around Santa Fe's beaches and the Ogtong cave with a local driver." ],
    [ "e-trike", "Self-drive e-trike", "Poblacion, Santa Fe", "123.8005 11.1585",
      { seats: 3, driver_included: false }, [],
      "Quiet electric trike for getting around town at your own pace." ],
    [ "action-camera", "GoPro Hero 12 with dive housing", "Kota Beach Road, Talisay", "123.7995 11.1730",
      { serial_no: "SF-GP12-01", accessories: [ "dive housing", "floaty", "head strap" ] }, [],
      "Film the reef and the cliff jumps; housing rated to 60 m." ],
    [ "action-camera", "DJI Osmo Action 4", "Poblacion, Santa Fe", "123.8005 11.1585",
      { serial_no: "SF-OA4-02", accessories: [ "selfie stick" ] }, [],
      "Waterproof action camera for snorkelling and boat days." ],
    [ "camera", "Sony A6400 with 18-135mm lens", "Poblacion, Santa Fe", "123.8005 11.1585",
      { serial_no: "SF-A64-01", lenses: [ "18-135mm" ] }, [],
      "Mirrorless kit for beach portraits and sunsets." ],
    [ "camera", "Fujifilm X-T30 with 35mm lens", "Poblacion, Santa Fe", "123.8005 11.1585",
      { serial_no: "SF-XT30-02", lenses: [ "35mm f/2" ] }, [],
      "Compact film-look camera for walking around town." ],
    [ "snorkel-gear", "Fins, mask and snorkel set", "Kota Beach Road, Talisay", "123.7995 11.1730",
      { sizes: %w[S M L] }, [],
      "Full snorkel set for a day of beach and island hopping." ],
    [ "snorkel-gear", "Kids' snorkel set", "Kota Beach Road, Talisay", "123.7995 11.1730",
      { sizes: %w[XS S] }, [],
      "Small mask, snorkel and fins for children." ],
    [ "van", "Hagnaya port to Santa Fe van transfer", "Santa Fe Port Road, Poblacion", "123.8040 11.1560",
      { seats: 12, luggage: 10, route: "Hagnaya port (San Remigio) to Santa Fe" }, [],
      "Meets the ferry from Hagnaya and drops you at your Santa Fe hotel." ],
    [ "van", "Santa Fe to Madridejos van transfer", "Poblacion, Santa Fe", "123.8005 11.1585",
      { seats: 10, luggage: 8, route: "Santa Fe to Madridejos" }, [],
      "Private van across the island to Madridejos and the lighthouse." ]
  ].freeze

  def up
    # A new database is loaded from schema.rb without the RAA-33 data, and may run this
    # before db:seed adds it; seeds.rb then loads both, in order.
    return unless select_value("SELECT 1 FROM areas WHERE slug = 'bantayan-island'")

    insert "areas", { slug: "santa-fe", kind: "town", name: "Santa Fe", aliases: array([ "Santa Fe, Bantayan" ]),
      center: point("123.8000 11.1580"), parent_id: id_of("areas", "bantayan-island") }

    insert "users", { email: EMAIL, name: "Santa Fe Island Adventures", phone: "+63 917 555 0142",
      role: "partner", registration_complete: true }
    insert "partner_profiles", { user_id: raw(partner_id), display_name: "Santa Fe Island Adventures",
      legal_first_name: "Maria", legal_last_name: "Dela Cruz", street: "Poblacion, Santa Fe", **ADDRESS }
    insert "partner_verifications", { user_id: raw(partner_id), status: "approved", verified_at: raw("now()") }

    LISTINGS.each do |category, title, street, location, attrs, landmarks, description|
      insert "listings", { title:, description:, status: "active", attrs: attrs.to_json, location: point(location),
        street:, **ADDRESS, partner_id: raw(partner_id),
        area_id: id_of("areas", "santa-fe"), category_id: id_of("categories", category) }
      landmarks.each do |landmark|
        insert "listing_landmarks", {
          listing_id: raw("(SELECT id FROM listings WHERE title = #{quote(title)} AND partner_id = #{partner_id})"),
          landmark_id: id_of("landmarks", landmark), relation: "visits"
        }, timestamps: false
      end
    end
  end

  def down
    execute "DELETE FROM listing_landmarks WHERE listing_id IN (SELECT id FROM listings WHERE partner_id = #{partner_id})"
    execute "DELETE FROM listings WHERE partner_id = #{partner_id}"
    execute "DELETE FROM partner_verifications WHERE user_id = #{partner_id}"
    execute "DELETE FROM partner_profiles WHERE user_id = #{partner_id}"
    execute "DELETE FROM users WHERE email = #{quote(EMAIL)} AND role = 'partner'"
    execute "DELETE FROM areas WHERE slug = 'santa-fe'"
  end

  private

  Raw = Struct.new(:sql)

  def raw(sql) = Raw.new(sql)

  def insert(table, values, timestamps: true)
    values = values.merge(created_at: raw("now()"), updated_at: raw("now()")) if timestamps
    sql_values = values.values.map { |value| value.is_a?(Raw) ? value.sql : quote(value) }
    execute "INSERT INTO #{table} (#{values.keys.join(', ')}) VALUES (#{sql_values.join(', ')})"
  end

  def partner_id
    "(SELECT id FROM users WHERE email = #{quote(EMAIL)} AND role = 'partner')"
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

  def quote(value)
    connection.quote(value)
  end
end
