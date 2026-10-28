# Seats per vehicle, and how many vehicles a trip item takes (RAA-191). A group of 10 on
# 2-seat motorbikes needs 5 of them; until now every vehicle booking took one, whatever the
# group.
#
# Every vehicle category's schema (those that ask for make, model and engine_cc) gets a
# required `seats`, rider or driver included, which the partner enters: there is no default.
# The vehicle listings already made get a one-off value by category so they stay valid.
# trip_items.units is the count the guest chose; null derives it from the people
# (Booking.units_for).
class AddSeatsToVehiclesAndUnitsToTripItems < ActiveRecord::Migration[8.1]
  SEATS = { type: "integer", minimum: 1, maximum: 60 }.freeze
  # The value existing listings get, by category slug.
  BACKFILL = { "motorcycle" => 2, "car" => 5, "van-rental" => 12 }.freeze

  def up
    add_column :trip_items, :units, :integer
    add_check_constraint :trip_items, "units IS NULL OR units BETWEEN 1 AND 99", name: "trip_items_units_range"
    self.class.seat(connection)
  end

  def down
    execute "UPDATE categories SET attribute_schema = jsonb_set(attribute_schema #- '{properties,seats}', '{required}', " \
      "(attribute_schema->'required') - 'seats'), updated_at = now() WHERE id IN (#{VEHICLE_CATEGORY_IDS})"
    remove_check_constraint :trip_items, name: "trip_items_units_range"
    remove_column :trip_items, :units
  end

  VEHICLE_CATEGORY_IDS =
    "SELECT id FROM categories WHERE attribute_schema->'properties' ?& array['make', 'model', 'engine_cc']".freeze

  # The schema change and the backfill, which db/seeds.rb also runs. Safe to run twice.
  def self.seat(connection)
    connection.execute "UPDATE categories SET attribute_schema = jsonb_set(jsonb_set(attribute_schema, " \
      "'{properties,seats}', #{connection.quote(SEATS.to_json)}::jsonb), '{required}', " \
      "(attribute_schema->'required') || '[\"seats\"]'::jsonb), updated_at = now() " \
      "WHERE id IN (#{VEHICLE_CATEGORY_IDS}) AND NOT (attribute_schema->'required') ? 'seats'"
    BACKFILL.each do |slug, seats|
      connection.execute "UPDATE listings SET attrs = jsonb_set(attrs, '{seats}', '#{seats}'::jsonb), updated_at = now() " \
        "WHERE NOT attrs ? 'seats' AND category_id IN (SELECT id FROM categories WHERE slug = #{connection.quote(slug)})"
    end
  end
end
