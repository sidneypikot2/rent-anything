# Tours run every day (RAA-117): the team dropped RAA-110's schedule (weekdays and extra
# tour_dates), blocked dates (availability_blocks, which M3 designs afresh for its partner
# calendar) and the tour category's life_vests attribute. The rows go with them; `down` brings
# the tables back empty and every tour running daily.
#
# db/seeds.rb runs backfill for a database loaded from schema.rb, in place of
# CreateTourDetails.backfill, which writes the weekdays column this removes.
class DropTourSchedule < ActiveRecord::Migration[8.1]
  TOUR_SCHEMA = {
    type: "object",
    properties: { guide_included: { type: "boolean" } },
    required: %w[guide_included]
  }.freeze

  # The sample tours become joiner tours with no price yet, as in CreateTourDetails.backfill.
  def self.backfill(connection)
    connection.execute <<~SQL
      UPDATE categories SET attribute_schema = #{connection.quote(TOUR_SCHEMA.to_json)}, updated_at = now()
      WHERE slug = 'tour' AND booking_type = 'activity'
    SQL
    connection.execute <<~SQL
      INSERT INTO tour_details (listing_id, tour_type, min_guests, max_guests, max_groups_per_day, duration_value,
        duration_unit, base_price_cents, created_at, updated_at)
      SELECT id, 'joiner', 1, LEAST(GREATEST(ROUND(COALESCE(max_group, 10)), 1), 100)::int, 1,
        -- Over a day it is counted in days, up to 30.
        CASE WHEN hours > 24 THEN LEAST(CEIL(hours / 24), 30) ELSE GREATEST(CEIL(hours), 1) END::int,
        CASE WHEN hours > 24 THEN 'days' ELSE 'hours' END, 0, now(), now()
      FROM (
        SELECT listings.id,
          jsonb_path_query_first(listings.attrs, '$.max_group ? (@.type() == "number")')::numeric AS max_group,
          COALESCE(jsonb_path_query_first(listings.attrs, '$.duration_hours ? (@.type() == "number")')::numeric, 4) AS hours
        FROM listings JOIN categories ON categories.id = listings.category_id
        WHERE categories.slug = 'tour'
      ) tours
      ON CONFLICT (listing_id) DO NOTHING
    SQL
    remove_life_vests(connection, also: %w[duration_hours max_group])
  end

  def self.remove_life_vests(connection, also: [])
    keys = [ "life_vests", *also ]
    connection.execute <<~SQL
      UPDATE listings SET attrs = attrs #{keys.map { "- #{connection.quote(_1)}" }.join(' ')}, updated_at = now()
      FROM categories WHERE categories.id = listings.category_id AND categories.slug = 'tour'
        AND attrs ?| ARRAY[#{keys.map { connection.quote(_1) }.join(', ')}]
    SQL
  end

  def up
    drop_table :tour_dates
    drop_table :availability_blocks
    remove_check_constraint :tour_details, name: "tour_details_weekdays_check"
    remove_column :tour_details, :weekdays
    execute <<~SQL
      UPDATE categories SET attribute_schema = #{quote(TOUR_SCHEMA.to_json)}, updated_at = now()
      WHERE slug = 'tour' AND booking_type = 'activity'
    SQL
    self.class.remove_life_vests(connection)
  end

  def down
    execute <<~SQL
      UPDATE categories SET attribute_schema = jsonb_set(attribute_schema, '{properties,life_vests}', '{"type": "boolean"}'),
        updated_at = now()
      WHERE slug = 'tour' AND booking_type = 'activity'
    SQL
    add_column :tour_details, :weekdays, :integer, array: true, null: false, default: []
    execute "UPDATE tour_details SET weekdays = '{0,1,2,3,4,5,6}'"
    add_check_constraint :tour_details, "weekdays <@ '{0,1,2,3,4,5,6}'::integer[]", name: "tour_details_weekdays_check"

    create_table :availability_blocks do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.date :starts_on, null: false
      t.date :ends_on, null: false
      t.string :reason
      t.timestamps
    end
    add_check_constraint :availability_blocks, "ends_on >= starts_on", name: "availability_blocks_dates_check"
    add_check_constraint :availability_blocks, "char_length(reason) <= 120", name: "availability_blocks_reason_length_check"
    execute <<~SQL
      ALTER TABLE availability_blocks ADD CONSTRAINT availability_blocks_no_overlap
      EXCLUDE USING gist (listing_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&)
    SQL

    create_table :tour_dates do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.date :date, null: false
      t.timestamps
    end
    add_index :tour_dates, %i[listing_id date], unique: true
  end
end
