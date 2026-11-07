# What a water activity partner enters beyond RAA-270's offers (RAA-271):
# - activity_offers.max_guests: riders who may share or take turns on one unit for that offer
#   (a jet ski's 15 minutes for 2, 30 for 4); null takes the detail's seats_per_unit.
# - activity_details.inclusions: what comes with it, from a fixed list (ActivityDetail::INCLUSIONS).
# - activity_add_ons: extras a guest may add, from a fixed list (ActivityAddOn::KINDS), each priced
#   per booking, unit or person. A removed one is archived, like an offer.
# - activity_delivery_zones: taking the unit to the guest's beach or chosen spot, priced by
#   straight-line distance from the listing's pin, as vehicle delivery zones (RAA-205). No zones,
#   no drop-off.
# Jet ski's builder defaults gain inclusions and riders per offer where they are still missing.
class AddActivityRidersAddOnsAndDeliveryZones < ActiveRecord::Migration[8.1]
  INCLUSIONS = %w[life_vest safety_briefing fuel marshal_boat waterproof_bag shower_room].freeze
  ADD_ONS = %w[drone_shot action_cam_video photo_package towel].freeze
  JET_SKI_RIDERS = { 15 => 2, 30 => 4, 60 => 4 }.freeze

  def self.list(values) = values.map { "'#{_1}'" }.join(", ")

  # Adds jet ski's inclusions and its offers' riders only where the defaults don't have them.
  def self.backfill(connection)
    row = connection.select_one("SELECT id, activity_defaults FROM categories WHERE slug = 'jet-ski' " \
      "AND booking_type = 'activity' AND activity_defaults IS NOT NULL")
    return unless row

    defaults = JSON.parse(row["activity_defaults"])
    defaults["inclusions"] ||= [ "life_vest" ]
    Array(defaults["offers"]).each do |offer|
      riders = JET_SKI_RIDERS[offer["duration_minutes"]]
      offer["max_guests"] ||= riders if riders
    end
    connection.execute "UPDATE categories SET activity_defaults = #{connection.quote(defaults.to_json)}, " \
      "updated_at = now() WHERE id = #{Integer(row['id'])}"
  end

  def up
    add_column :activity_offers, :max_guests, :integer
    add_check_constraint :activity_offers, "max_guests BETWEEN 1 AND 100", name: "activity_offers_max_guests_check"

    add_column :activity_details, :inclusions, :string, array: true, null: false, default: []
    add_check_constraint :activity_details, "inclusions <@ ARRAY[#{self.class.list(INCLUSIONS)}]::varchar[]",
      name: "activity_details_inclusions_check"

    create_table :activity_add_ons do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }
      t.string :kind, null: false
      t.bigint :price_cents, null: false
      t.string :charged_per, null: false
      t.integer :position, null: false
      t.datetime :archived_at
      t.timestamps
    end
    add_index :activity_add_ons, %i[listing_id kind], unique: true, where: "archived_at IS NULL",
      name: "index_activity_add_ons_on_listing_and_kind"
    add_check_constraint :activity_add_ons, "kind IN (#{self.class.list(ADD_ONS)})", name: "activity_add_ons_kind_check"
    add_check_constraint :activity_add_ons, "price_cents > 0", name: "activity_add_ons_price_check"
    add_check_constraint :activity_add_ons, "charged_per IN ('booking', 'unit', 'person')",
      name: "activity_add_ons_charged_per_check"

    create_table :activity_delivery_zones do |t|
      t.references :activity_detail, null: false, foreign_key: { on_delete: :cascade }
      t.integer :max_distance_m, null: false
      t.bigint :fee_cents, null: false
      t.timestamps
    end
    add_check_constraint :activity_delivery_zones, "max_distance_m BETWEEN 100 AND 50000",
      name: "activity_delivery_zones_distance_check"
    add_check_constraint :activity_delivery_zones, "fee_cents >= 0", name: "activity_delivery_zones_fee_check"

    self.class.backfill(connection)
  end

  def down
    drop_table :activity_delivery_zones
    drop_table :activity_add_ons
    remove_column :activity_details, :inclusions
    remove_column :activity_offers, :max_guests
  end
end
