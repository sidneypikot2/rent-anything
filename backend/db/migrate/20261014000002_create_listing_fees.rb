# Listing fees (RAA-104): the extra charges a partner adds to any listing, whatever its
# category — a cleaning fee, an environmental fee, an extra bed, a helmet. Each is charged
# once per booking, per night, per guest, per guest per night or per unit; an optional one
# is an add-on the guest picks. Typed rows, not attrs, so the database checks the money.
class CreateListingFees < ActiveRecord::Migration[8.1]
  def change
    create_table :listing_fees do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.string :name, null: false
      t.bigint :amount_cents, null: false
      t.string :charged_per, null: false
      t.boolean :required, null: false, default: true
      t.integer :position, null: false
      t.timestamps
    end
    add_index :listing_fees, %i[listing_id name], unique: true
    add_check_constraint :listing_fees, "char_length(name) BETWEEN 1 AND 60", name: "listing_fees_name_length_check"
    add_check_constraint :listing_fees, "amount_cents >= 0", name: "listing_fees_amount_check"
    add_check_constraint :listing_fees, "charged_per IN ('booking', 'night', 'guest', 'guest_night', 'unit')",
      name: "listing_fees_charged_per_check"
    add_check_constraint :listing_fees, "position >= 1", name: "listing_fees_position_check"
  end
end
