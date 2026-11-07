# What a partner says about the jet ski itself (RAA-273), checked in the listing's attrs against
# the jet ski category's attribute_schema: its brand, model, engine size, power and features.
# None is required, so the jet ski listings saved before this still save; the partner wizard asks
# for brand and model. Its seats stay the activity's seats_per_unit. The brand is `brand`, never
# `make`: a schema with make, model and engine_cc is a vehicle rental (Category#vehicle?).
class AddJetSkiDetails < ActiveRecord::Migration[8.1]
  FEATURES = %w[reverse_gear braking_system cruise_control no_wake_mode boarding_step waterproof_storage
    bluetooth_audio tow_hook].freeze

  SCHEMA = {
    "type" => "object",
    "properties" => {
      "brand" => { "type" => "string", "minLength" => 1, "maxLength" => 50 },
      "model" => { "type" => "string", "minLength" => 1, "maxLength" => 50 },
      "engine_cc" => { "type" => "integer", "minimum" => 50, "maximum" => 2000 },
      "horsepower" => { "type" => "integer", "minimum" => 10, "maximum" => 400 },
      "features" => { "type" => "array", "uniqueItems" => true, "items" => { "type" => "string", "enum" => FEATURES } }
    }
  }.freeze

  def self.apply(connection) = set_schema(connection, SCHEMA)
  def self.unapply(connection) = set_schema(connection, {})

  def self.set_schema(connection, schema)
    connection.execute "UPDATE categories SET attribute_schema = #{connection.quote(schema.to_json)}, " \
      "updated_at = now() WHERE slug = 'jet-ski' AND booking_type = 'activity'"
  end

  def up = self.class.apply(connection)
  def down = self.class.unapply(connection)
end
