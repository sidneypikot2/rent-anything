# Listing units (RAA-98, SPEC.md "Units"): one row per physical item, room or vehicle a
# listing offers, so a shop with five pairs of fins is one listing with five units. Bookings
# and availability blocks will belong to a unit in M3. Every existing listing gets its first
# unit; db/seeds.rb does the same for a database loaded from schema.rb.
class CreateListingUnits < ActiveRecord::Migration[8.1]
  def change
    create_table :listing_units do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.integer :position, null: false
      t.timestamps
    end
    add_index :listing_units, %i[listing_id position], unique: true
    add_check_constraint :listing_units, "position >= 1", name: "listing_units_position_check"

    reversible do |dir|
      dir.up do
        execute <<~SQL
          INSERT INTO listing_units (listing_id, position, created_at, updated_at)
          SELECT id, 1, now(), now() FROM listings
        SQL
      end
    end
  end
end
