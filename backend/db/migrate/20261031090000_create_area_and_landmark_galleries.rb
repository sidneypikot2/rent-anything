# Destination and place photos (RAA-210): an area keeps several photos in the team's order,
# the first being its banner, so its one banner (RAA-164) becomes photo 1; and a landmark gets
# photos the same way. Both are stored as listing photos are (RAA-106), at a key made from the
# row. The unique order is checked at commit, so a move can shift positions inside one
# transaction.
class CreateAreaAndLandmarkGalleries < ActiveRecord::Migration[8.1]
  def change
    add_column :area_photos, :position, :integer, null: false, default: 1
    change_column_default :area_photos, :position, from: 1, to: nil
    remove_index :area_photos, :area_id, unique: true
    add_unique_constraint :area_photos, %i[area_id position], deferrable: :deferred,
      name: "area_photos_area_id_position_key"
    add_check_constraint :area_photos, "position >= 1", name: "area_photos_position_check"

    create_table :landmark_photos do |t|
      t.references :landmark, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.integer :position, null: false
      t.string :filename, null: false
      t.string :content_type, null: false
      t.bigint :byte_size, null: false
      t.string :checksum, null: false
      t.datetime :uploaded_at
      t.datetime :sized_at
      t.timestamps
    end
    add_unique_constraint :landmark_photos, %i[landmark_id position], deferrable: :deferred,
      name: "landmark_photos_landmark_id_position_key"
    add_check_constraint :landmark_photos, "position >= 1", name: "landmark_photos_position_check"
    add_check_constraint :landmark_photos, "content_type IN ('image/jpeg', 'image/png', 'image/webp')",
      name: "landmark_photos_content_type_check"
    add_check_constraint :landmark_photos, "byte_size > 0", name: "landmark_photos_byte_size_check"
    add_index :landmark_photos, :created_at, where: "uploaded_at IS NULL", name: "index_landmark_photos_unfinished"
  end
end
