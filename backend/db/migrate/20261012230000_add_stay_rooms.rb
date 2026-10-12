# Stay attrs by place type (RAA-94): beds belong to rooms. An entire place has bedrooms
# (named "Bedroom N" by the web app), each with its own beds, and a bathroom count; a private
# or shared room is a single room, with a private or shared bathroom and who guests share
# with; a shared room (a dorm) also has a dorm type, its room's beds are every bed in it, and
# its guests are the guests per booking. Every accommodation leaf gets the new schema and
# existing stay listings' attrs are rewritten to it.
#
# This runs everywhere a migration runs and from db/seeds.rb; it changes nothing where the
# RAA-33 tree doesn't exist and can run twice. `down` puts the RAA-82 schema and attrs back.
require_relative "20261010000003_add_accommodation_property_types"

class AddStayRooms < ActiveRecord::Migration[8.1]
  BED_TYPES = %w[single double queen king bunk sofa_bed floor_mattress].freeze
  SHARED_WITH = %w[host host_family other_guests].freeze

  ROOM = {
    type: "object",
    properties: {
      beds: {
        type: "array", minItems: 1, uniqueItems: true,
        items: {
          type: "object",
          properties: { type: { type: "string", enum: BED_TYPES }, count: { type: "integer", minimum: 1, maximum: 20 } },
          required: %w[type count], additionalProperties: false
        }
      }
    },
    required: %w[beds], additionalProperties: false
  }.freeze

  def self.place(type, rooms:, required:)
    { if: { properties: { place_type: { const: type } }, required: %w[place_type] },
      then: { properties: { rooms: rooms }, required: } }
  end

  STAY_SCHEMA = {
    type: "object",
    properties: {
      place_type: { type: "string", enum: %w[entire_place private_room shared_room] },
      rooms: { type: "array", minItems: 1, maxItems: 20, items: ROOM },
      guests: { type: "integer", minimum: 1, maximum: 50 },
      bathrooms: { type: "number", minimum: 0, maximum: 20, multipleOf: 0.5 },
      bathroom: { type: "string", enum: %w[private shared] },
      dorm_type: { type: "string", enum: %w[mixed female_only male_only] },
      shared_with: { type: "array", uniqueItems: true, items: { type: "string", enum: SHARED_WITH } },
      amenities: AddAccommodationPropertyTypes::STAY_SCHEMA[:properties][:amenities]
    },
    required: %w[place_type rooms guests],
    allOf: [
      place("entire_place", rooms: {}, required: %w[bathrooms]),
      place("private_room", rooms: { maxItems: 1 }, required: %w[bathroom]),
      place("shared_room", rooms: { maxItems: 1 }, required: %w[bathroom dorm_type shared_with]).deep_merge(
        then: { properties: { shared_with: { minItems: 1 } } }
      )
    ]
  }.freeze

  def up
    return unless accommodation_id

    set_schema(STAY_SCHEMA)
    stay_listings.each do |id, attrs|
      next if attrs.key?("rooms") || !attrs.key?("beds")

      attrs = attrs.merge("rooms" => [ { "beds" => attrs.delete("beds") } ])
      unless attrs["place_type"] == "entire_place"
        attrs["bathroom"] = attrs.delete("bathrooms").to_f >= 1 ? "private" : "shared"
      end
      attrs.merge!("dorm_type" => "mixed", "shared_with" => [ "other_guests" ]) if attrs["place_type"] == "shared_room"
      update_attrs(id, attrs)
    end
  end

  def down
    return unless accommodation_id

    set_schema(AddAccommodationPropertyTypes::STAY_SCHEMA)
    stay_listings.each do |id, attrs|
      next unless attrs.key?("rooms")

      counts = Hash.new(0)
      Array(attrs["rooms"]).flat_map { _1["beds"] }.each { |bed| counts[bed["type"]] += bed["count"] }
      attrs = attrs.except("rooms", "bathroom", "dorm_type", "shared_with").merge(
        "beds" => counts.map { |type, count| { "type" => type, "count" => [ count, 20 ].min } },
        "bathrooms" => attrs["bathrooms"] || (attrs["bathroom"] == "private" ? 1 : 0)
      )
      update_attrs(id, attrs)
    end
  end

  private

  def accommodation_id
    @accommodation_id ||= select_value("SELECT id FROM categories WHERE slug = 'accommodation' AND booking_type IS NULL")
  end

  def set_schema(schema)
    execute "UPDATE categories SET attribute_schema = #{quote(schema.to_json)}, updated_at = now() " \
      "WHERE parent_id = #{accommodation_id} AND booking_type = 'stay'"
  end

  def stay_listings
    select_rows("SELECT listings.id, listings.attrs FROM listings JOIN categories ON categories.id = listings.category_id " \
      "WHERE categories.parent_id = #{accommodation_id}").map { |id, attrs| [ id, attrs.is_a?(String) ? JSON.parse(attrs) : attrs ] }
  end

  def update_attrs(id, attrs)
    execute "UPDATE listings SET attrs = #{quote(attrs.to_json)}, updated_at = now() WHERE id = #{id}"
  end
end
