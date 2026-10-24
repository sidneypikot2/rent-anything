# Seeding an area from the admin console (RAA-168): where its last run got to, when it
# finished, and what it did (counts, skipped places, an error).
class AddSeedingToAreas < ActiveRecord::Migration[8.1]
  def change
    create_enum :area_seed_status, %w[idle queued running done failed]

    change_table :areas, bulk: true do |t|
      t.enum :seed_status, enum_type: :area_seed_status, default: "idle", null: false
      t.datetime :seeded_at
      t.jsonb :seed_report, default: {}, null: false
    end
  end
end
