# Listing photos (RAA-106): one row per image (Active Storage, on R2), in the order the
# partner set; the first is the cover. A table of its own rather than has_many_attached so
# the order is a column. The unique order is checked at commit, so a reorder can swap
# positions inside one transaction.
class CreateListingPhotos < ActiveRecord::Migration[8.1]
  def change
    create_table :listing_photos do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.integer :position, null: false
      t.timestamps
    end
    add_unique_constraint :listing_photos, %i[listing_id position], deferrable: :deferred,
      name: "listing_photos_listing_id_position_key"
    add_check_constraint :listing_photos, "position >= 1", name: "listing_photos_position_check"
  end
end
