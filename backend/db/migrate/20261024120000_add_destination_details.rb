# Destination details (RAA-164): what the team writes about an area in the admin console — a
# tagline, a description and travel info — the tags they pick for it, and one banner photo.
# The photo's file is in R2 at a key made from the row (AreaPhoto#key), as listing photos are.
class AddDestinationDetails < ActiveRecord::Migration[8.1]
  def change
    change_table :areas, bulk: true do |t|
      t.string :tagline, null: false, default: ""
      t.text :description, null: false, default: ""
      t.text :getting_there, null: false, default: ""
      t.string :best_time_to_visit, null: false, default: ""
    end
    add_check_constraint :areas, "char_length(tagline) <= 120", name: "areas_tagline_length_check"

    create_table :area_tags, primary_key: %i[area_id tag_id] do |t|
      t.references :area, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :tag, null: false, foreign_key: { on_delete: :cascade }
    end

    create_table :area_photos do |t|
      t.references :area, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.string :filename, null: false
      t.string :content_type, null: false
      t.bigint :byte_size, null: false
      t.string :checksum, null: false
      t.datetime :uploaded_at
      t.datetime :sized_at
      t.timestamps
    end
    add_check_constraint :area_photos, "content_type IN ('image/jpeg', 'image/png', 'image/webp')",
      name: "area_photos_content_type_check"
    add_check_constraint :area_photos, "byte_size > 0", name: "area_photos_byte_size_check"
    add_index :area_photos, :created_at, where: "uploaded_at IS NULL", name: "index_area_photos_unfinished"
  end
end
