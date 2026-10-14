# Tour details (RAA-110): what a tour in the `tour` category is, typed so the database checks
# the money and the counts. A private tour is booked by one group at a base price per group,
# and each inclusion the group picks costs a fixed price per head; a joiner tour sells seats at
# a base price per head, its inclusions bundled in (their price_per_head_cents stays 0). It
# runs on its weekdays (0 Sunday … 6 Saturday) and on its extra tour_dates, not on its
# availability_blocks; for a multi-day tour those are start days. max_groups_per_day is saved now and enforced with bookings (M3).
#
# availability_blocks is the generic table SPEC plans for every listing's partner calendar;
# tours use it first. duration_hours and max_group leave the tour category's attrs for
# tour_details. The existing tours become daily joiner tours with no price yet (0), until their
# partners set one; db/seeds.rb does the same for a database loaded from schema.rb.
class CreateTourDetails < ActiveRecord::Migration[8.1]
  TOUR_SCHEMA = {
    type: "object",
    properties: { guide_included: { type: "boolean" }, life_vests: { type: "boolean" } },
    required: %w[guide_included]
  }.freeze
  OLD_TOUR_SCHEMA = {
    type: "object",
    properties: {
      guide_included: { type: "boolean" }, life_vests: { type: "boolean" }, duration_hours: { type: "number" },
      max_group: { type: "integer" }
    },
    required: %w[guide_included]
  }.freeze

  # Moves duration_hours and max_group out of the tours' attrs into a tour_details row each.
  def self.backfill(connection)
    connection.execute <<~SQL
      UPDATE categories SET attribute_schema = #{connection.quote(TOUR_SCHEMA.to_json)}, updated_at = now()
      WHERE slug = 'tour' AND booking_type = 'activity'
    SQL
    connection.execute <<~SQL
      INSERT INTO tour_details (listing_id, tour_type, min_guests, max_guests, max_groups_per_day, duration_value,
        duration_unit, weekdays, base_price_cents, created_at, updated_at)
      SELECT id, 'joiner', 1, LEAST(GREATEST(ROUND(COALESCE(max_group, 10)), 1), 100)::int, 1,
        -- Over a day it is counted in days, up to 30.
        CASE WHEN hours > 24 THEN LEAST(CEIL(hours / 24), 30) ELSE GREATEST(CEIL(hours), 1) END::int,
        CASE WHEN hours > 24 THEN 'days' ELSE 'hours' END, '{0,1,2,3,4,5,6}', 0, now(), now()
      FROM (
        SELECT listings.id,
          jsonb_path_query_first(listings.attrs, '$.max_group ? (@.type() == "number")')::numeric AS max_group,
          COALESCE(jsonb_path_query_first(listings.attrs, '$.duration_hours ? (@.type() == "number")')::numeric, 4) AS hours
        FROM listings JOIN categories ON categories.id = listings.category_id
        WHERE categories.slug = 'tour'
      ) tours
      ON CONFLICT (listing_id) DO NOTHING
    SQL
    connection.execute <<~SQL
      UPDATE listings SET attrs = attrs - 'duration_hours' - 'max_group', updated_at = now()
      FROM categories WHERE categories.id = listings.category_id AND categories.slug = 'tour'
        AND (attrs ? 'duration_hours' OR attrs ? 'max_group')
    SQL
  end

  def up
    create_table :tour_details do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.string :tour_type, null: false
      t.integer :min_guests, null: false, default: 1
      t.integer :max_guests, null: false
      t.integer :max_groups_per_day, null: false, default: 1
      t.integer :duration_value, null: false
      t.string :duration_unit, null: false
      t.integer :weekdays, array: true, null: false, default: []
      t.bigint :base_price_cents, null: false, default: 0
      t.timestamps
    end
    add_check_constraint :tour_details, "tour_type IN ('private', 'joiner')", name: "tour_details_tour_type_check"
    add_check_constraint :tour_details, "min_guests >= 1 AND max_guests BETWEEN min_guests AND 100",
      name: "tour_details_guests_check"
    add_check_constraint :tour_details, "max_groups_per_day BETWEEN 1 AND 100", name: "tour_details_max_groups_check"
    add_check_constraint :tour_details, "duration_unit IN ('hours', 'days')", name: "tour_details_duration_unit_check"
    add_check_constraint :tour_details,
      "duration_value >= 1 AND duration_value <= CASE duration_unit WHEN 'hours' THEN 24 ELSE 30 END",
      name: "tour_details_duration_value_check"
    add_check_constraint :tour_details, "weekdays <@ '{0,1,2,3,4,5,6}'::integer[]", name: "tour_details_weekdays_check"
    add_check_constraint :tour_details, "base_price_cents >= 0", name: "tour_details_base_price_check"

    create_table :tour_dates do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.date :date, null: false
      t.timestamps
    end
    add_index :tour_dates, %i[listing_id date], unique: true

    create_table :tour_inclusions do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.string :kind, null: false
      t.string :options, array: true, null: false, default: []
      t.string :note
      t.bigint :price_per_head_cents, null: false, default: 0
      t.timestamps
    end
    add_index :tour_inclusions, %i[listing_id kind], unique: true
    add_check_constraint :tour_inclusions, "kind IN ('accommodation', 'transport', 'meal')",
      name: "tour_inclusions_kind_check"
    add_check_constraint :tour_inclusions, "char_length(note) <= 120", name: "tour_inclusions_note_length_check"
    add_check_constraint :tour_inclusions, "price_per_head_cents >= 0", name: "tour_inclusions_price_check"

    create_table :availability_blocks do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.date :starts_on, null: false
      t.date :ends_on, null: false
      t.string :reason
      t.timestamps
    end
    add_check_constraint :availability_blocks, "ends_on >= starts_on", name: "availability_blocks_dates_check"
    add_check_constraint :availability_blocks, "char_length(reason) <= 120", name: "availability_blocks_reason_length_check"
    # One listing's blocks never overlap; the GiST index also finds the blocks on a date.
    execute <<~SQL
      ALTER TABLE availability_blocks ADD CONSTRAINT availability_blocks_no_overlap
      EXCLUDE USING gist (listing_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&)
    SQL

    self.class.backfill(connection)
  end

  def down
    execute <<~SQL
      UPDATE listings SET attrs = attrs || jsonb_build_object('max_group', tour_details.max_guests) ||
        CASE tour_details.duration_unit WHEN 'hours' THEN jsonb_build_object('duration_hours', tour_details.duration_value)
          ELSE jsonb_build_object('duration_hours', tour_details.duration_value * 24) END
      FROM tour_details WHERE tour_details.listing_id = listings.id
    SQL
    execute "UPDATE categories SET attribute_schema = #{quote(OLD_TOUR_SCHEMA.to_json)} WHERE slug = 'tour' AND booking_type = 'activity'"
    drop_table :availability_blocks
    drop_table :tour_inclusions
    drop_table :tour_dates
    drop_table :tour_details
  end
end
