# What a business's shop page needs (RAA-281), entered by its partner:
# - the business: opening hours (one daily range and the weekdays it is closed), the languages
#   it speaks, its host, the rules a stay keeps (check-in window, check-out, house rules) and up
#   to six questions and answers, plus its logo and cover photos;
# - a tour: the times it starts (none: any time), what it leaves out, three more inclusion kinds
#   (guide, gear, entrance fees) and its stops in order;
# - a vehicle: whether a driver's licence is needed (`licence_required`, for cars).
class AddBusinessShopDetails < ActiveRecord::Migration[8.1]
  HALF_HOUR = "'^([01][0-9]|2[0-3]):(00|30)$'"
  TIMES = %w[opens_at closes_at check_in_from check_in_until check_out_by quiet_from].freeze
  OLD_KINDS = %w[accommodation transport meal].freeze
  NEW_KINDS = %w[accommodation transport meal guide gear entrance_fees].freeze
  LICENCE = { type: "boolean" }.freeze

  def up
    change_table :businesses, bulk: true do |t|
      TIMES.each { |time| t.string time }
      t.integer :closed_days, array: true, default: [], null: false
      t.string :languages, array: true, default: [], null: false
      t.string :host_name
      t.string :host_intro
      t.string :house_rules, array: true, default: [], null: false
      t.string :rules_note
      t.jsonb :faqs, default: [], null: false
    end
    TIMES.each do |time|
      add_check_constraint :businesses, "#{time} IS NULL OR #{time}::text ~ #{HALF_HOUR}", name: "businesses_#{time}_check"
    end
    add_check_constraint :businesses, "(opens_at IS NULL) = (closes_at IS NULL) AND (opens_at IS NULL OR opens_at < closes_at)",
      name: "businesses_hours_check"
    add_check_constraint :businesses, "closed_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]", name: "businesses_closed_days_check"
    add_check_constraint :businesses, "char_length(host_name) <= 60", name: "businesses_host_name_length_check"
    add_check_constraint :businesses, "char_length(host_intro) <= 160", name: "businesses_host_intro_length_check"
    add_check_constraint :businesses, "char_length(rules_note) <= 300", name: "businesses_rules_note_length_check"
    add_check_constraint :businesses, "jsonb_typeof(faqs) = 'array' AND jsonb_array_length(faqs) <= 6", name: "businesses_faqs_check"

    %i[business_photos business_logos].each do |table|
      create_table table do |t|
        t.references :business, null: false, foreign_key: { on_delete: :cascade }, index: table == :business_photos
        t.integer :position if table == :business_photos
        t.string :filename, null: false
        t.string :content_type, null: false
        t.bigint :byte_size, null: false
        t.string :checksum, null: false
        t.datetime :uploaded_at
        t.datetime :sized_at
        t.timestamps
      end
      add_check_constraint table, "content_type IN ('image/jpeg', 'image/png', 'image/webp')", name: "#{table}_content_type_check"
      add_check_constraint table, "byte_size > 0", name: "#{table}_byte_size_check"
      add_index table, :created_at, where: "uploaded_at IS NULL", name: "index_#{table}_unfinished"
    end
    change_column_null :business_photos, :position, false
    add_check_constraint :business_photos, "position >= 1", name: "business_photos_position_check"
    add_index :business_logos, :business_id, unique: true

    add_column :tour_details, :start_times, :string, array: true, default: [], null: false
    add_column :tour_details, :not_included, :string
    add_check_constraint :tour_details, "array_to_string(start_times, ',') ~ '^(([01][0-9]|2[0-3]):(00|30)(,|$))*$' " \
      "AND cardinality(start_times) <= 8", name: "tour_details_start_times_check"
    add_check_constraint :tour_details, "char_length(not_included) <= 300", name: "tour_details_not_included_length_check"
    kinds_check(NEW_KINDS)

    add_column :listing_landmarks, :position, :integer
    execute <<~SQL
      UPDATE listing_landmarks SET position = numbered.position FROM (
        SELECT listing_id, landmark_id, row_number() OVER (PARTITION BY listing_id ORDER BY landmark_id) AS position
        FROM listing_landmarks
      ) numbered
      WHERE numbered.listing_id = listing_landmarks.listing_id AND numbered.landmark_id = listing_landmarks.landmark_id
    SQL

    self.class.licence(connection)
  end

  def down
    execute "UPDATE categories SET attribute_schema = attribute_schema #- '{properties,licence_required}', updated_at = now() " \
      "WHERE attribute_schema->'properties' ? 'licence_required'"
    remove_column :listing_landmarks, :position
    execute "DELETE FROM tour_inclusions WHERE kind NOT IN (#{OLD_KINDS.map { |kind| connection.quote(kind) }.join(', ')})"
    kinds_check(OLD_KINDS)
    remove_check_constraint :tour_details, name: "tour_details_not_included_length_check"
    remove_check_constraint :tour_details, name: "tour_details_start_times_check"
    remove_column :tour_details, :not_included
    remove_column :tour_details, :start_times
    drop_table :business_logos
    drop_table :business_photos
    %w[hours closed_days host_name_length host_intro_length rules_note_length faqs].each do |name|
      remove_check_constraint :businesses, name: "businesses_#{name}_check"
    end
    TIMES.each { |time| remove_check_constraint :businesses, name: "businesses_#{time}_check" }
    change_table :businesses, bulk: true do |t|
      t.remove(*TIMES, :closed_days, :languages, :host_name, :host_intro, :house_rules, :rules_note, :faqs)
    end
  end

  # The vehicle schemas' optional `licence_required`, which db/seeds.rb also runs. Safe to run twice.
  def self.licence(connection)
    connection.execute "UPDATE categories SET attribute_schema = jsonb_set(attribute_schema, '{properties,licence_required}', " \
      "#{connection.quote(LICENCE.to_json)}::jsonb), updated_at = now() " \
      "WHERE attribute_schema->'properties' ?& array['make', 'model', 'engine_cc'] " \
      "AND NOT attribute_schema->'properties' ? 'licence_required'"
  end

  private

  def kinds_check(kinds)
    remove_check_constraint :tour_inclusions, name: "tour_inclusions_kind_check"
    add_check_constraint :tour_inclusions, "kind IN (#{kinds.map { |kind| connection.quote(kind) }.join(', ')})",
      name: "tour_inclusions_kind_check"
  end
end
