# Vehicle rentals (RAA-88): the kinds of vehicle as leaves under Rentals, all sharing one
# attribute schema (make, model, engine size, color), and a description on every Rentals
# leaf for a partner choosing one. The sample motorcycles get their make, model and engine
# from their titles; any other motorcycle is asked for them on its next edit.
#
# This runs everywhere a migration runs, production included, and from db/seeds.rb for a
# database loaded from schema.rb. It only changes anything where the RAA-33 tree exists and
# can run twice; `down` refuses once a listing uses one of the new leaves.
class AddVehicleRentalTypes < ActiveRecord::Migration[8.1]
  VEHICLE_SCHEMA = {
    type: "object",
    properties: {
      make: { type: "string", minLength: 1, maxLength: 50 },
      model: { type: "string", minLength: 1, maxLength: 50 },
      engine_cc: { type: "integer", minimum: 50, maximum: 10_000 },
      color: { type: "string", maxLength: 30 },
      plate_no: { type: "string" },
      helmet_included: { type: "boolean" }
    },
    required: %w[make model engine_cc]
  }.freeze

  OLD_MOTORCYCLE_SCHEMA = {
    type: "object", properties: { plate_no: { type: "string" }, helmet_included: { type: "boolean" } },
    required: %w[helmet_included]
  }.freeze

  VEHICLES = [
    # slug, name, description
    [ "motorcycle", "Motorcycle", "A motorbike or scooter, the easiest way to get around the island." ],
    [ "car", "Car", "A sedan, hatchback or SUV, self-drive or with a driver." ],
    [ "van-rental", "Van", "A van for a family or group, self-drive or with a driver." ],
    [ "tricycle", "Tricycle", "A motorbike with a sidecar, the local way around town." ],
    [ "multicab", "Multicab", "A small utility vehicle with bench seats in the back for a group." ]
  ].freeze
  NEW_SLUGS = VEHICLES.map(&:first) - [ "motorcycle" ]

  # The other Rentals leaves keep their schema and get a description.
  DESCRIPTIONS = {
    "bicycle" => "A mountain, city or beach bike.",
    "e-trike" => "An electric tricycle, quiet and good for short trips around town.",
    "action-camera" => "A small waterproof camera, such as a GoPro, for diving and adventure.",
    "camera" => "A mirrorless or DSLR camera, with its lenses.",
    "snorkel-gear" => "A mask, snorkel and fins."
  }.freeze

  # The sample motorcycles (RAA-33, RAA-51), by the start of their title.
  SAMPLE_MOTORCYCLES = {
    "Honda Click 125" => { "make" => "Honda", "model" => "Click 125", "engine_cc" => 125 },
    "Yamaha XTZ 125" => { "make" => "Yamaha", "model" => "XTZ 125", "engine_cc" => 125 },
    "Yamaha NMAX 155" => { "make" => "Yamaha", "model" => "NMAX 155", "engine_cc" => 155 }
  }.freeze

  def up
    return unless rentals_id

    VEHICLES.each do |slug, name, description|
      values = { name:, description:, booking_type: "rental", attribute_schema: VEHICLE_SCHEMA.to_json }
      if select_value("SELECT 1 FROM categories WHERE slug = #{quote(slug)}")
        execute "UPDATE categories SET #{assignments(values)}, updated_at = now() WHERE slug = #{quote(slug)}"
      else
        execute "INSERT INTO categories (slug, parent_id, #{values.keys.join(', ')}, created_at, updated_at) " \
          "VALUES (#{quote(slug)}, #{rentals_id}, #{values.values.map { quote(_1) }.join(', ')}, now(), now())"
      end
    end
    DESCRIPTIONS.each do |slug, description|
      execute "UPDATE categories SET description = #{quote(description)}, updated_at = now() WHERE slug = #{quote(slug)}"
    end

    motorcycles.each do |id, title, attrs|
      vehicle = SAMPLE_MOTORCYCLES.find { |prefix, _| title.start_with?(prefix) }&.last
      update_attrs(id, attrs.merge(vehicle)) if vehicle && !attrs.key?("make")
    end
  end

  def down
    return unless rentals_id

    new_ids = "SELECT id FROM categories WHERE slug IN (#{NEW_SLUGS.map { quote(_1) }.join(', ')})"
    if select_value("SELECT 1 FROM listings WHERE category_id IN (#{new_ids})")
      raise ActiveRecord::IrreversibleMigration, "Listings use the new vehicle types; move them first"
    end

    execute "DELETE FROM categories WHERE id IN (#{new_ids})"
    execute "UPDATE categories SET description = '', updated_at = now() WHERE parent_id = #{rentals_id}"
    execute "UPDATE categories SET attribute_schema = #{quote(OLD_MOTORCYCLE_SCHEMA.to_json)}, updated_at = now() " \
      "WHERE slug = 'motorcycle'"
    motorcycles.each do |id, _title, attrs|
      update_attrs(id, attrs.except("make", "model", "engine_cc", "color").reverse_merge("helmet_included" => false))
    end
  end

  private

  def rentals_id
    @rentals_id ||= select_value("SELECT id FROM categories WHERE slug = 'rentals' AND booking_type IS NULL")
  end

  def motorcycles
    select_rows("SELECT listings.id, listings.title, listings.attrs FROM listings " \
      "JOIN categories ON categories.id = listings.category_id WHERE categories.slug = 'motorcycle'")
      .map { |id, title, attrs| [ id, title, attrs.is_a?(String) ? JSON.parse(attrs) : attrs ] }
  end

  def update_attrs(id, attrs)
    execute "UPDATE listings SET attrs = #{quote(attrs.to_json)}, updated_at = now() WHERE id = #{id}"
  end

  def assignments(values)
    values.map { |column, value| "#{column} = #{quote(value)}" }.join(", ")
  end
end
