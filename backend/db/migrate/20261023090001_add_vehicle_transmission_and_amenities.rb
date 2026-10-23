# Vehicle details (RAA-149): every vehicle rental says its transmission, and what comes with
# it from a fixed list of amenities, the inclusions PH rental shops advertise and riders look
# for (helmets, a raincoat, a phone holder, a full tank, insurance, the OR/CR...). A vehicle
# that came with helmets (helmet_included) now has the rider_helmet amenity instead. The
# sample motorcycles get their transmission; any other vehicle is asked for it on its next
# edit, as make and model were (RAA-88).
#
# This runs everywhere a migration runs, production included, and from db/seeds.rb for a
# database loaded from schema.rb. It only changes the vehicle categories (those whose schema
# asks for make, model and engine_cc) and can run twice.
class AddVehicleTransmissionAndAmenities < ActiveRecord::Migration[8.1]
  TRANSMISSIONS = %w[automatic semi_automatic manual].freeze
  AMENITIES = %w[
    rider_helmet passenger_helmet raincoat phone_holder full_tank insurance registration_papers lock top_box
    cargo_straps usb_charger roadside_assistance unlimited_km maintenance_checked air_conditioning child_seat
    driver_available
  ].freeze

  VEHICLE_SCHEMA = {
    type: "object",
    properties: {
      make: { type: "string", minLength: 1, maxLength: 50 },
      model: { type: "string", minLength: 1, maxLength: 50 },
      engine_cc: { type: "integer", minimum: 50, maximum: 10_000 },
      transmission: { type: "string", enum: TRANSMISSIONS },
      color: { type: "string", maxLength: 30 },
      plate_no: { type: "string" },
      amenities: { type: "array", items: { type: "string", enum: AMENITIES }, uniqueItems: true }
    },
    required: %w[make model engine_cc transmission]
  }.freeze

  # The schema before (20261011000002).
  OLD_VEHICLE_SCHEMA = {
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

  # The sample motorcycles (RAA-33, RAA-51), by their model.
  SAMPLE_TRANSMISSIONS = { "Click 125" => "automatic", "NMAX 155" => "automatic", "XTZ 125" => "manual" }.freeze

  def up
    execute "UPDATE categories SET attribute_schema = #{quote(VEHICLE_SCHEMA.to_json)}, updated_at = now() " \
      "WHERE id IN (#{vehicle_category_ids})"
    vehicles.each do |id, attrs|
      changed = attrs.except("helmet_included")
      if attrs["helmet_included"] == true
        changed["amenities"] = ((attrs["amenities"].is_a?(Array) ? attrs["amenities"] : []) | [ "rider_helmet" ])
      end
      transmission = SAMPLE_TRANSMISSIONS[attrs["model"]]
      changed["transmission"] = transmission if transmission && !attrs.key?("transmission")
      update_attrs(id, changed) unless changed == attrs
    end
  end

  def down
    execute "UPDATE categories SET attribute_schema = #{quote(OLD_VEHICLE_SCHEMA.to_json)}, updated_at = now() " \
      "WHERE id IN (#{vehicle_category_ids})"
    vehicles.each do |id, attrs|
      changed = attrs.except("transmission", "amenities")
      changed["helmet_included"] = true if Array(attrs["amenities"]).include?("rider_helmet")
      update_attrs(id, changed) unless changed == attrs
    end
  end

  private

  def vehicle_category_ids
    "SELECT id FROM categories WHERE attribute_schema->'properties' ?& array['make', 'model', 'engine_cc']"
  end

  def vehicles
    select_rows("SELECT id, attrs FROM listings WHERE category_id IN (#{vehicle_category_ids})")
      .map { |id, attrs| [ id, attrs.is_a?(String) ? JSON.parse(attrs) : attrs ] }
  end

  def update_attrs(id, attrs)
    execute "UPDATE listings SET attrs = #{quote(attrs.to_json)}, updated_at = now() WHERE id = #{id}"
  end
end
