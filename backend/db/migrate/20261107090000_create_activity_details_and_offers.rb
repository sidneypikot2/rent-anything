# The water activity builder (RAA-270): what a jet ski, a dive or a paraw sail is, typed so the
# database checks the money, the times and the counts. activity_details says how it is sold
# (per unit: a machine, kayak or boat for the guest's party; per person: seats on a shared one),
# when it runs (open hours, any half hour from opening, or set departures) and how many fit on
# a unit. activity_offers are what a guest picks, each a length and a price: "30 minutes,
# ₱1,500". A removed offer is archived, not deleted, so a booking made with it keeps it.
#
# categories.activity_defaults pre-fills the builder for each water activity; backfill fills
# them, and db/seeds.rb runs it again on a database loaded from schema.rb.
class CreateActivityDetailsAndOffers < ActiveRecord::Migration[8.1]
  HALF_HOUR = "'^([01][0-9]|2[0-3]):(00|30)$'".freeze

  # slug => defaults; prices are always the partner's.
  DEFAULTS = {
    "jet-ski" => { sold_by: "unit", schedule: "open_hours", opens_at: "08:00", closes_at: "17:00", seats_per_unit: 2,
      offers: [ { name: "15 minutes", duration_minutes: 15 }, { name: "30 minutes", duration_minutes: 30 },
        { name: "1 hour", duration_minutes: 60 } ] },
    "scuba-diving" => { sold_by: "person", schedule: "departures", departure_times: %w[08:00 13:00], seats_per_unit: 4,
      min_age: 10, offers: [ { name: "Try dive", duration_minutes: 180 }, { name: "Fun dive", duration_minutes: 120 } ] },
    "freediving" => { sold_by: "person", schedule: "departures", departure_times: %w[08:00 14:00], seats_per_unit: 3,
      min_age: 12, offers: [ { name: "Intro session", duration_minutes: 120 } ] },
    "paraw-sailing" => { sold_by: "unit", schedule: "departures", departure_times: %w[09:00 15:00], seats_per_unit: 8,
      offers: [ { name: "2-hour sail", duration_minutes: 120 } ] },
    "kayaking" => { sold_by: "unit", schedule: "open_hours", opens_at: "07:00", closes_at: "17:00", seats_per_unit: 2,
      offers: [ { name: "1 hour", duration_minutes: 60 }, { name: "2 hours", duration_minutes: 120 } ] },
    "stand-up-paddle" => { sold_by: "unit", schedule: "open_hours", opens_at: "07:00", closes_at: "17:00", seats_per_unit: 1,
      offers: [ { name: "1 hour", duration_minutes: 60 } ] },
    "banana-boat" => { sold_by: "person", schedule: "open_hours", opens_at: "09:00", closes_at: "17:00", seats_per_unit: 6,
      offers: [ { name: "15-minute ride", duration_minutes: 15 } ] },
    "sunset-cruise" => { sold_by: "person", schedule: "departures", departure_times: %w[16:30], seats_per_unit: 12,
      offers: [ { name: "Sunset cruise", duration_minutes: 120 } ] },
    "kitesurfing" => { sold_by: "person", schedule: "open_hours", opens_at: "08:00", closes_at: "17:00", seats_per_unit: 1,
      offers: [ { name: "1-hour lesson", duration_minutes: 60 }, { name: "2-hour lesson", duration_minutes: 120 } ] }
  }.freeze

  # Sets the defaults where they are still empty, never over the team's.
  def self.backfill(connection)
    DEFAULTS.each do |slug, defaults|
      connection.execute "UPDATE categories SET activity_defaults = #{connection.quote(defaults.to_json)}, " \
        "updated_at = now() WHERE slug = #{connection.quote(slug)} AND booking_type = 'activity' " \
        "AND activity_defaults IS NULL"
    end
  end

  def up
    add_column :categories, :activity_defaults, :jsonb

    create_table :activity_details do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.string :sold_by, null: false
      t.string :schedule, null: false
      t.string :opens_at
      t.string :closes_at
      t.string :departure_times, array: true, null: false, default: []
      t.integer :seats_per_unit, null: false, default: 1
      t.integer :min_age
      t.text :included
      t.text :requirements
      t.timestamps
    end
    add_check_constraint :activity_details, "sold_by IN ('unit', 'person')", name: "activity_details_sold_by_check"
    add_check_constraint :activity_details, "schedule IN ('open_hours', 'departures')", name: "activity_details_schedule_check"
    add_check_constraint :activity_details,
      "schedule <> 'open_hours' OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at ~ #{HALF_HOUR} " \
        "AND closes_at ~ #{HALF_HOUR} AND opens_at < closes_at)",
      name: "activity_details_open_hours_check"
    add_check_constraint :activity_details,
      "cardinality(departure_times) BETWEEN 1 AND 24 OR schedule <> 'departures'",
      name: "activity_details_departures_check"
    add_check_constraint :activity_details,
      "array_to_string(departure_times, ',') ~ '^(([01][0-9]|2[0-3]):(00|30)(,|$))*$'",
      name: "activity_details_departure_times_check"
    add_check_constraint :activity_details, "seats_per_unit BETWEEN 1 AND 100", name: "activity_details_seats_check"
    add_check_constraint :activity_details, "min_age BETWEEN 1 AND 99", name: "activity_details_min_age_check"
    add_check_constraint :activity_details, "char_length(included) <= 500", name: "activity_details_included_length_check"
    add_check_constraint :activity_details, "char_length(requirements) <= 500",
      name: "activity_details_requirements_length_check"

    create_table :activity_offers do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }
      t.string :name, null: false
      t.integer :duration_minutes, null: false
      t.bigint :price_cents, null: false
      t.integer :position, null: false
      t.datetime :archived_at
      t.timestamps
    end
    # One offer of a name on a listing at a time; archived ones step aside.
    add_index :activity_offers, "listing_id, lower(name)", unique: true, where: "archived_at IS NULL",
      name: "index_activity_offers_on_listing_and_name"
    add_check_constraint :activity_offers, "char_length(name) BETWEEN 1 AND 60", name: "activity_offers_name_length_check"
    add_check_constraint :activity_offers, "duration_minutes BETWEEN 5 AND 720 AND duration_minutes % 5 = 0",
      name: "activity_offers_duration_check"
    add_check_constraint :activity_offers, "price_cents > 0", name: "activity_offers_price_check"

    self.class.backfill(connection)
  end

  def down
    drop_table :activity_offers
    drop_table :activity_details
    remove_column :categories, :activity_defaults
  end
end
