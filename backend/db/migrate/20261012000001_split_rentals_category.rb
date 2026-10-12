# Vehicle and equipment rentals (RAA-88): the Rentals group splits in two, so a partner
# picks Vehicle rental or Equipment rental first. The Rentals row becomes Vehicle rental
# (same id, so its vehicle leaves stay put) and the cameras and snorkel gear move under a
# new Equipment rental. Every leaf gets a description, so each group's types are cards in
# the add-listing picker (RAA-89).
#
# Nothing routes, searches or tags by a parent's slug, so renaming one is safe. This runs
# everywhere a migration runs and from db/seeds.rb; it changes nothing where the RAA-33 tree
# doesn't exist and can run twice.
class SplitRentalsCategory < ActiveRecord::Migration[8.1]
  EQUIPMENT = %w[action-camera camera snorkel-gear].freeze

  # Leaves that had no description yet; one already written is kept.
  DESCRIPTIONS = {
    "tour" => "A guided trip: island hopping, snorkelling, a town or food tour.",
    "photographer" => "A photographer for a shoot, an event or your trip, with edited photos.",
    "van" => "A ride from the port or airport to where guests stay, or between towns."
  }.freeze

  def up
    if (rentals = parent_id("rentals"))
      execute "UPDATE categories SET slug = 'vehicle-rentals', name = 'Vehicle rental', updated_at = now() " \
        "WHERE id = #{rentals}"
    end
    vehicles = parent_id("vehicle-rentals")
    return unless vehicles

    unless parent_id("equipment-rentals")
      execute "INSERT INTO categories (slug, name, parent_id, booking_type, attribute_schema, created_at, updated_at) " \
        "VALUES ('equipment-rentals', 'Equipment rental', NULL, NULL, '{}', now(), now())"
    end
    execute "UPDATE categories SET parent_id = #{parent_id('equipment-rentals')}, updated_at = now() " \
      "WHERE slug IN (#{EQUIPMENT.map { quote(_1) }.join(', ')})"

    DESCRIPTIONS.each do |slug, description|
      execute "UPDATE categories SET description = #{quote(description)}, updated_at = now() " \
        "WHERE slug = #{quote(slug)} AND description = ''"
    end
  end

  def down
    vehicles = parent_id("vehicle-rentals")
    return unless vehicles

    execute "UPDATE categories SET parent_id = #{vehicles}, updated_at = now() " \
      "WHERE slug IN (#{EQUIPMENT.map { quote(_1) }.join(', ')})"
    execute "DELETE FROM categories WHERE slug = 'equipment-rentals' AND booking_type IS NULL"
    execute "UPDATE categories SET slug = 'rentals', name = 'Rentals', updated_at = now() WHERE id = #{vehicles}"
    DESCRIPTIONS.each do |slug, description|
      execute "UPDATE categories SET description = '', updated_at = now() " \
        "WHERE slug = #{quote(slug)} AND description = #{quote(description)}"
    end
  end

  private

  def parent_id(slug)
    select_value("SELECT id FROM categories WHERE slug = #{quote(slug)} AND booking_type IS NULL")
  end
end
