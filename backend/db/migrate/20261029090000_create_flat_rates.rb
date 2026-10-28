# A flat price for what has no rate of its own (RAA-191): gear by the item and day, a transfer
# by the vehicle and trip. With it every kind of listing is priced at checkout, as stays, tours
# and vehicles are. A price of 0 is "no price yet", which a partner sets.
class CreateFlatRates < ActiveRecord::Migration[8.1]
  def change
    create_table :flat_rates do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.bigint :price_cents, null: false, default: 0
      t.timestamps
    end
    add_check_constraint :flat_rates, "price_cents >= 0", name: "flat_rates_price_check"
  end
end
