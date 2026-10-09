# Search events (RAA-60): what guests type into the search box and what they pick, kept
# 90 days. Feeds search-term popularity and the admin queues (missing search terms,
# suggested destination links). No personal data: no user, no IP, and the browser's session
# id only as a keyed hash, enough to tell that two picks came from one visit.
class CreateSearchEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :search_events do |t|
      t.string :query_normalized, null: false, limit: 100
      t.integer :result_count, null: false
      t.string :target_type
      t.bigint :target_id
      t.string :session_hash, null: false, limit: 64
      t.datetime :created_at, null: false
    end
    add_index :search_events, :created_at
    add_index :search_events, %i[target_type target_id]
    add_index :search_events, :session_hash
    add_check_constraint :search_events, "result_count >= 0", name: "search_events_result_count_check"
    add_check_constraint :search_events, "target_type IN ('Area', 'Landmark', 'Tag', 'Listing')",
      name: "search_events_target_type_check"
    add_check_constraint :search_events, "(target_type IS NULL) = (target_id IS NULL)",
      name: "search_events_target_check"
    add_check_constraint :search_events, "session_hash ~ '^[0-9a-f]{64}$'", name: "search_events_session_hash_check"
  end
end
