# The partner calendar (RAA-118): days a listing takes no bookings (availability_blocks, as
# RAA-110 had them before RAA-117 dropped them), a partner's per-date changes to a listing's
# price, units on sale and minimum stay (listing_days), and bookings. Until checkout (M4) a
# booking is one the partner took offline; checkout will make the same rows. Each booking
# takes `quantity` of the listing's units on the days it covers, counted per day under a lock
# on the listing row; tying a booking to one unit (SPEC.md's EXCLUDE on unit and period) is M4's.
class CreatePartnerCalendar < ActiveRecord::Migration[8.1]
  def change
    create_table :availability_blocks do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.date :starts_on, null: false
      t.date :ends_on, null: false
      t.string :reason
      t.timestamps
    end
    add_check_constraint :availability_blocks, "ends_on >= starts_on", name: "availability_blocks_dates_check"
    add_check_constraint :availability_blocks, "char_length(reason) <= 120", name: "availability_blocks_reason_length_check"
    # The constraint's GiST index also serves lookups by listing.
    reversible do |dir|
      dir.up do
        execute <<~SQL
          ALTER TABLE availability_blocks ADD CONSTRAINT availability_blocks_no_overlap
          EXCLUDE USING gist (listing_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&)
        SQL
      end
      dir.down { execute "ALTER TABLE availability_blocks DROP CONSTRAINT availability_blocks_no_overlap" }
    end

    # A null value keeps the listing's own: its price, every unit on sale, its minimum stay.
    create_table :listing_days do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.date :date, null: false
      t.bigint :price_cents
      t.integer :units_available
      t.integer :min_nights
      t.timestamps
    end
    add_index :listing_days, %i[listing_id date], unique: true
    add_check_constraint :listing_days, "price_cents > 0", name: "listing_days_price_check"
    add_check_constraint :listing_days, "units_available >= 0 AND units_available <= 100",
      name: "listing_days_units_check"
    add_check_constraint :listing_days, "min_nights >= 1 AND min_nights <= 365", name: "listing_days_min_nights_check"
    add_check_constraint :listing_days, "price_cents IS NOT NULL OR units_available IS NOT NULL OR min_nights IS NOT NULL",
      name: "listing_days_not_empty_check"

    # A stay's dates are check-in and check-out (it takes the nights between); any other
    # booking takes every day from starts_on to ends_on.
    create_enum :booking_status, %w[confirmed cancelled]
    create_enum :booking_source, %w[offline checkout]
    create_table :bookings do |t|
      t.references :listing, null: false, foreign_key: true, index: false
      t.references :user, foreign_key: true
      t.string :guest_name, null: false
      t.date :starts_on, null: false
      t.date :ends_on, null: false
      t.integer :quantity, null: false, default: 1
      t.enum :status, enum_type: :booking_status, null: false, default: "confirmed"
      t.enum :source, enum_type: :booking_source, null: false
      t.bigint :total_cents, null: false
      t.text :notes, null: false, default: ""
      t.timestamps
    end
    add_index :bookings, %i[listing_id starts_on ends_on]
    add_check_constraint :bookings, "ends_on >= starts_on", name: "bookings_dates_check"
    add_check_constraint :bookings, "quantity >= 1 AND quantity <= 99", name: "bookings_quantity_check"
    add_check_constraint :bookings, "total_cents >= 0", name: "bookings_total_check"
    add_check_constraint :bookings, "char_length(guest_name) >= 1 AND char_length(guest_name) <= 80",
      name: "bookings_guest_name_length_check"
    add_check_constraint :bookings, "char_length(notes) <= 500", name: "bookings_notes_length_check"
  end
end
