# Tours and Water activities (RAA-268): the Services group, which only Tour was left in, becomes
# Tours (same id, so Tour stays put), for trips to several places at one price. Water activities
# is a new group, one type for each thing to do on the water; their pricing comes later.
#
# Nothing routes, searches or tags by a parent's slug, so renaming one is safe. This runs
# everywhere a migration runs and from db/seeds.rb; it changes nothing where the tree doesn't
# exist and can run twice.
class SplitToursAndActivities < ActiveRecord::Migration[8.1]
  TOUR_DESCRIPTION = "A guided trip to several places at one price: island hopping, a town or food tour.".freeze
  OLD_TOUR_DESCRIPTION = "A guided trip: island hopping, snorkelling, a town or food tour.".freeze

  # slug, name, description, unit_name, unit_name_plural
  WATER_ACTIVITIES = [
    [ "jet-ski", "Jet ski", "Jet skis to ride by the minute or the hour.", "jet ski", "jet skis" ],
    [ "scuba-diving", "Scuba diving", "Guided dives, try dives and dive courses.", "dive group", "dive groups" ],
    [ "freediving", "Freediving", "Freediving sessions and courses with an instructor.", "instructor", "instructors" ],
    [ "paraw-sailing", "Paraw sailing", "A sail on a traditional outrigger boat.", "boat", "boats" ],
    [ "kayaking", "Kayaking", "Kayaks to paddle, alone or with a guide.", "kayak", "kayaks" ],
    [ "stand-up-paddle", "Stand up paddle", "Paddle boards to rent, or a lesson on one.", "board", "boards" ],
    [ "banana-boat", "Banana boat ride", "A towed ride for a group.", "boat", "boats" ],
    [ "sunset-cruise", "Sunset cruise", "An evening on the water at sunset.", "boat", "boats" ],
    [ "kitesurfing", "Kitesurfing", "Kitesurfing lessons and gear.", "instructor", "instructors" ]
  ].freeze

  def up
    execute "UPDATE categories SET slug = 'tours', name = 'Tours', updated_at = now() " \
      "WHERE slug = 'services' AND booking_type IS NULL"
    return unless parent_id("tours")

    execute "UPDATE categories SET description = #{quote(TOUR_DESCRIPTION)}, updated_at = now() " \
      "WHERE slug = 'tour' AND description = #{quote(OLD_TOUR_DESCRIPTION)}"

    unless parent_id("water-activities")
      execute "INSERT INTO categories (slug, name, parent_id, booking_type, attribute_schema, created_at, updated_at) " \
        "VALUES ('water-activities', 'Water activities', NULL, NULL, '{}', now(), now())"
    end
    WATER_ACTIVITIES.each { add_water_activity(*_1) }
  end

  # Refused once a water activity has a listing: the foreign key keeps it from losing its category.
  def down
    slugs = WATER_ACTIVITIES.map { quote(_1.first) }.join(", ")
    execute "DELETE FROM categories WHERE slug IN (#{slugs}) AND booking_type = 'activity'"
    execute "DELETE FROM categories WHERE slug = 'water-activities' AND booking_type IS NULL"
    execute "UPDATE categories SET description = #{quote(OLD_TOUR_DESCRIPTION)}, updated_at = now() " \
      "WHERE slug = 'tour' AND description = #{quote(TOUR_DESCRIPTION)}"
    execute "UPDATE categories SET slug = 'services', name = 'Services', updated_at = now() " \
      "WHERE slug = 'tours' AND booking_type IS NULL"
  end

  private

  def add_water_activity(slug, name, description, unit_name, unit_name_plural)
    return if select_value("SELECT id FROM categories WHERE slug = #{quote(slug)}")

    execute "INSERT INTO categories (slug, name, parent_id, booking_type, attribute_schema, description, " \
      "unit_name, unit_name_plural, commission_bps, created_at, updated_at) " \
      "SELECT #{quote(slug)}, #{quote(name)}, #{parent_id('water-activities')}, 'activity', '{}', " \
      "#{quote(description)}, #{quote(unit_name)}, #{quote(unit_name_plural)}, commission_bps, now(), now() " \
      "FROM categories WHERE slug = 'tour'"
  end

  def parent_id(slug)
    select_value("SELECT id FROM categories WHERE slug = #{quote(slug)} AND booking_type IS NULL")
  end
end
