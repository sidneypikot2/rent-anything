# Destination links (RAA-55): two places guests usually combine (Moalboal and Kawasan
# Falls, Bantayan Island and Malapascua), curated by an admin. Explore recommends the
# other end of each link, in either direction, so a pair is stored once: the lower
# (type, id) end is always the source.
class CreateDestinationLinks < ActiveRecord::Migration[8.1]
  def change
    create_table :destination_links do |t|
      t.string :source_type, null: false
      t.bigint :source_id, null: false
      t.string :target_type, null: false
      t.bigint :target_id, null: false
      t.string :kind, null: false
      t.integer :weight, limit: 2, null: false, default: 1
      t.timestamps
    end
    add_index :destination_links, %i[source_type source_id target_type target_id], unique: true,
      name: "index_destination_links_on_pair"
    add_index :destination_links, %i[target_type target_id]
    add_check_constraint :destination_links, "source_type IN ('Area', 'Landmark') AND target_type IN ('Area', 'Landmark')",
      name: "destination_links_types_check"
    add_check_constraint :destination_links, "(source_type, source_id) < (target_type, target_id)",
      name: "destination_links_order_check"
    add_check_constraint :destination_links, "kind IN ('bundled', 'adjacent')", name: "destination_links_kind_check"
    add_check_constraint :destination_links, "weight BETWEEN 1 AND 3", name: "destination_links_weight_check"
  end
end
