# Fewer categories to start with (RAA-103): Photographer, Bicycle, E-trike, Multicab and
# Tricycle go, with their listings. A listing's units and trip items go with it (their foreign
# keys cascade); its landmark links and search events don't cascade, so they're deleted first.
#
# This runs everywhere a migration runs and from db/seeds.rb, after the sample-data loaders
# that create these; it changes nothing where they don't exist and can run twice. The data
# is gone afterwards, so it can't be rolled back.
class RemoveUnfocusedCategories < ActiveRecord::Migration[8.1]
  SLUGS = %w[photographer bicycle e-trike multicab tricycle].freeze

  def up
    categories = "SELECT id FROM categories WHERE slug IN (#{SLUGS.map { quote(_1) }.join(', ')}) " \
      "AND booking_type IS NOT NULL"
    listings = "SELECT id FROM listings WHERE category_id IN (#{categories})"

    execute "DELETE FROM search_events WHERE target_type = 'Listing' AND target_id IN (#{listings})"
    execute "DELETE FROM listing_landmarks WHERE listing_id IN (#{listings})"
    execute "DELETE FROM listings WHERE id IN (#{listings})"
    execute "DELETE FROM category_tags WHERE category_id IN (#{categories})"
    execute "DELETE FROM categories WHERE id IN (#{categories})"
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
