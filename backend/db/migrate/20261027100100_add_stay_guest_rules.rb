# Multi-room stays (RAA-182): a stay says whether children and infants take a bed in a room
# (children do and infants don't when it doesn't say) and whether pets are allowed, and how
# many. Every accommodation leaf's attribute_schema gains the four optional attrs; existing
# listings keep theirs, so they take the defaults.
#
# This runs everywhere a migration runs and from db/seeds.rb; it changes nothing where the
# RAA-33 tree doesn't exist and can run twice.
require_relative "20261012230000_add_stay_rooms"

class AddStayGuestRules < ActiveRecord::Migration[8.1]
  PROPERTIES = {
    children_count: { type: "boolean" },
    infants_count: { type: "boolean" },
    pets_allowed: { type: "boolean" },
    max_pets: { type: "integer", minimum: 1, maximum: 20 }
  }.freeze

  STAY_SCHEMA = AddStayRooms::STAY_SCHEMA.merge(properties: AddStayRooms::STAY_SCHEMA[:properties].merge(PROPERTIES)).freeze

  def up
    set_schema(STAY_SCHEMA) if accommodation_id
  end

  def down
    set_schema(AddStayRooms::STAY_SCHEMA) if accommodation_id
  end

  private

  def accommodation_id
    @accommodation_id ||= select_value("SELECT id FROM categories WHERE slug = 'accommodation' AND booking_type IS NULL")
  end

  def set_schema(schema)
    execute "UPDATE categories SET attribute_schema = #{quote(schema.to_json)}, updated_at = now() " \
      "WHERE parent_id = #{accommodation_id} AND booking_type = 'stay'"
  end
end
