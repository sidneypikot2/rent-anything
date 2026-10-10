# Accommodation property types (RAA-82): the kinds of stay as leaves under Accommodation,
# each with a description for a partner choosing one, all sharing one
# attribute schema (what guests book, beds, guests, bathrooms, amenities). The old
# "Hotel or cottage" leaf becomes "Hotel" (same id), the sample cottages move to Cottage, and
# existing stay listings' attrs are rewritten to the new schema.
#
# This runs everywhere a migration runs, production included, and from db/seeds.rb for a
# database loaded from schema.rb. It only changes anything where the RAA-33 tree exists and
# can run twice; `down` puts the old leaf, schema and attrs back.
class AddAccommodationPropertyTypes < ActiveRecord::Migration[8.1]
  PLACE_TYPES = %w[entire_place private_room shared_room].freeze
  BED_TYPES = %w[single double queen king bunk sofa_bed floor_mattress].freeze
  AMENITIES = %w[
    wifi aircon fan hot_shower towels_linens toiletries drinking_water
    kitchen refrigerator tv workspace washing_machine
    free_parking pool beachfront balcony garden
    breakfast_included airport_pickup backup_power
    smoke_alarm fire_extinguisher first_aid_kit cctv
  ].freeze

  STAY_SCHEMA = {
    type: "object",
    properties: {
      place_type: { type: "string", enum: PLACE_TYPES },
      beds: {
        type: "array", minItems: 1, uniqueItems: true,
        items: {
          type: "object",
          properties: { type: { type: "string", enum: BED_TYPES }, count: { type: "integer", minimum: 1, maximum: 20 } },
          required: %w[type count], additionalProperties: false
        }
      },
      guests: { type: "integer", minimum: 1, maximum: 50 },
      bathrooms: { type: "number", minimum: 0, maximum: 20, multipleOf: 0.5 },
      amenities: { type: "array", uniqueItems: true, items: { type: "string", enum: AMENITIES } }
    },
    required: %w[place_type beds guests bathrooms]
  }.freeze

  OLD_HOTEL = { name: "Hotel or cottage", schema: {
    type: "object", properties: { guests: { type: "integer" }, amenities: { type: "array", items: { type: "string" } } },
    required: %w[guests]
  } }.freeze

  PROPERTY_TYPES = [
    # slug, name, description
    [ "apartment", "Apartment", "A unit in a building or condo, with its own entrance from a shared hallway or lobby." ],
    [ "house", "House", "A standalone home. Guests may book the whole house or a room in it." ],
    [ "guest-house", "Guest house", "A small, often family-run place with a few rooms — a pension house or homestay." ],
    [ "hotel", "Hotel", "A business with many rooms, a front desk and daily housekeeping." ],
    [ "resort", "Resort", "A property with leisure on site — a pool, beach access, a restaurant." ],
    [ "villa", "Villa", "A private, usually upscale house, often with a garden or pool." ],
    [ "hostel", "Hostel", "A budget stay with dorm beds and shared spaces." ],
    [ "cottage", "Cottage or bungalow", "A small standalone hut or nipa cottage, often near the beach." ]
  ].freeze

  # The sample listings (RAA-33, RAA-51) that are cottages rather than hotel rooms.
  COTTAGE_TITLES = [ "Beachfront nipa cottage, Santa Fe", "Beachfront bamboo cottage" ].freeze

  # Old free-text amenities that have a new name; the rest are kept if allowed, else dropped.
  AMENITY_RENAMES = { "hot-shower" => "hot_shower", "breakfast" => "breakfast_included" }.freeze

  def up
    return unless accommodation_id

    PROPERTY_TYPES.each do |slug, name, description|
      values = { name:, description:, booking_type: "stay", attribute_schema: STAY_SCHEMA.to_json }
      if select_value("SELECT 1 FROM categories WHERE slug = #{quote(slug)}")
        execute "UPDATE categories SET #{assignments(values)}, updated_at = now() WHERE slug = #{quote(slug)}"
      else
        execute "INSERT INTO categories (slug, parent_id, #{values.keys.join(', ')}, created_at, updated_at) " \
          "VALUES (#{quote(slug)}, #{accommodation_id}, #{values.values.map { quote(_1) }.join(', ')}, now(), now())"
      end
    end

    execute "UPDATE listings SET category_id = (SELECT id FROM categories WHERE slug = 'cottage') " \
      "WHERE category_id = (SELECT id FROM categories WHERE slug = 'hotel') AND title IN (#{COTTAGE_TITLES.map { quote(_1) }.join(', ')})"

    stay_listings.each do |id, attrs|
      next if attrs.key?("place_type")

      update_attrs(id, {
        "place_type" => "private_room", "beds" => [ { "type" => "double", "count" => 1 } ],
        "guests" => attrs["guests"] || 1, "bathrooms" => 1,
        "amenities" => Array(attrs["amenities"]).map { AMENITY_RENAMES.fetch(_1, _1) }.select { AMENITIES.include?(_1) }.uniq
      })
    end
  end

  def down
    return unless accommodation_id

    stay_listings.each do |id, attrs|
      update_attrs(id, { "guests" => attrs["guests"], "amenities" => Array(attrs["amenities"]).map { AMENITY_RENAMES.key(_1) || _1 } })
    end
    execute "UPDATE listings SET category_id = (SELECT id FROM categories WHERE slug = 'hotel') " \
      "WHERE category_id IN (SELECT id FROM categories WHERE parent_id = #{accommodation_id} AND slug <> 'hotel')"
    execute "DELETE FROM categories WHERE parent_id = #{accommodation_id} AND slug <> 'hotel'"
    execute "UPDATE categories SET name = #{quote(OLD_HOTEL[:name])}, description = '', " \
      "attribute_schema = #{quote(OLD_HOTEL[:schema].to_json)}, updated_at = now() WHERE slug = 'hotel'"
  end

  private

  def accommodation_id
    @accommodation_id ||= select_value("SELECT id FROM categories WHERE slug = 'accommodation' AND booking_type IS NULL")
  end

  def stay_listings
    select_rows("SELECT listings.id, listings.attrs FROM listings JOIN categories ON categories.id = listings.category_id " \
      "WHERE categories.parent_id = #{accommodation_id}").map { |id, attrs| [ id, attrs.is_a?(String) ? JSON.parse(attrs) : attrs ] }
  end

  def update_attrs(id, attrs)
    execute "UPDATE listings SET attrs = #{quote(attrs.to_json)}, updated_at = now() WHERE id = #{id}"
  end

  def assignments(values)
    values.map { |column, value| "#{column} = #{quote(value)}" }.join(", ")
  end
end
