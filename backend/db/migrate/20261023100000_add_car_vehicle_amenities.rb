# Car amenities (RAA-150): cars and vans tick what car renters look for — Bluetooth audio,
# CarPlay / Android Auto, GPS, a dashcam, a reverse camera, RFID toll tags, the early warning
# device, a spare tire and tools, a first aid kit — on top of RAA-149's list, which was mostly
# for motorbikes. Which category offers which is the web form's; the schema only lists them all.
#
# It only changes the vehicle categories (those whose schema asks for make, model and
# engine_cc) and can run twice. Down drops the new amenities from any listing that has them.
class AddCarVehicleAmenities < ActiveRecord::Migration[8.1]
  OLD_AMENITIES = %w[
    rider_helmet passenger_helmet raincoat phone_holder full_tank insurance registration_papers lock top_box
    cargo_straps usb_charger roadside_assistance unlimited_km maintenance_checked air_conditioning child_seat
    driver_available
  ].freeze
  NEW_AMENITIES = %w[
    bluetooth_audio carplay_android_auto gps_navigation dashcam reverse_camera rfid_toll early_warning_device
    spare_tire_tools first_aid_kit
  ].freeze
  AMENITIES = (OLD_AMENITIES + NEW_AMENITIES).freeze

  def up
    set_amenities(AMENITIES)
  end

  def down
    set_amenities(OLD_AMENITIES)
    select_rows("SELECT id, attrs FROM listings WHERE category_id IN (#{vehicle_category_ids})").each do |id, attrs|
      attrs = JSON.parse(attrs) if attrs.is_a?(String)
      next unless attrs["amenities"].is_a?(Array) && attrs["amenities"].intersect?(NEW_AMENITIES)

      attrs["amenities"] -= NEW_AMENITIES
      execute "UPDATE listings SET attrs = #{quote(attrs.to_json)}, updated_at = now() WHERE id = #{id}"
    end
  end

  private

  # Swaps the amenities enum inside each vehicle category's schema, leaving the rest of it alone.
  def set_amenities(amenities)
    items = { type: "string", enum: amenities }.to_json
    execute "UPDATE categories SET attribute_schema = jsonb_set(attribute_schema, '{properties,amenities,items}', " \
      "#{quote(items)}::jsonb), updated_at = now() " \
      "WHERE id IN (#{vehicle_category_ids}) AND attribute_schema->'properties' ? 'amenities'"
  end

  def vehicle_category_ids
    "SELECT id FROM categories WHERE attribute_schema->'properties' ?& array['make', 'model', 'engine_cc']"
  end
end
