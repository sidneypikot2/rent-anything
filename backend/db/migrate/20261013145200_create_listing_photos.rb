# Listing photos (RAA-106): one row per photo, in the order the partner set; the first is the
# cover. The file itself is in R2 at a key made from the row (ListingPhoto#key), so the row
# keeps only what the upload declared. uploaded_at is set once the browser's upload is
# confirmed, sized_at once the card and large sizes exist. The unique order is checked at
# commit, so a reorder can swap positions inside one transaction.
class CreateListingPhotos < ActiveRecord::Migration[8.1]
  def change
    create_table :listing_photos do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.integer :position, null: false
      t.string :filename, null: false
      t.string :content_type, null: false
      t.bigint :byte_size, null: false
      t.string :checksum, null: false
      t.datetime :uploaded_at
      t.datetime :sized_at
      t.timestamps
    end
    add_unique_constraint :listing_photos, %i[listing_id position], deferrable: :deferred,
      name: "listing_photos_listing_id_position_key"
    add_check_constraint :listing_photos, "position >= 1", name: "listing_photos_position_check"
    add_check_constraint :listing_photos, "content_type IN ('image/jpeg', 'image/png', 'image/webp')",
      name: "listing_photos_content_type_check"
    add_check_constraint :listing_photos, "byte_size > 0", name: "listing_photos_byte_size_check"
    add_index :listing_photos, :created_at, where: "uploaded_at IS NULL", name: "index_listing_photos_unfinished"
  end
end
