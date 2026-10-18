# Checkout and the booking lifecycle (RAA-132). A listing is booked instantly or on request
# (booking_mode); a guest's checkout turns trip items into bookings and pays for them
# (payments, a stub until Xendit). A booking snapshots what it was sold under (its price
# breakdown, the category's commission, the cancellation policy and booking mode) and every
# change of status is a booking_events row. A trip item has at most one booking that still
# holds its dates, so a declined, expired or cancelled one can be booked again.
class CreateCheckouts < ActiveRecord::Migration[8.1]
  HOLDING = %w[requested accepted awaiting_payment confirmed in_progress completed].freeze

  def change
    add_column :listings, :booking_mode, :string, null: false, default: "request"
    add_check_constraint :listings, "booking_mode IN ('instant', 'request')", name: "listings_booking_mode_check"

    # The platform's share of a booking, in basis points (1000 = 10%).
    add_column :categories, :commission_bps, :integer, null: false, default: 1000
    add_check_constraint :categories, "commission_bps >= 0 AND commission_bps <= 10000", name: "categories_commission_check"

    create_table :checkouts do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.references :trip, foreign_key: { on_delete: :nullify }
      t.string :idempotency_key, null: false
      t.bigint :total_cents, null: false
      t.timestamps
    end
    add_index :checkouts, %i[user_id idempotency_key], unique: true
    add_check_constraint :checkouts, "total_cents >= 0", name: "checkouts_total_check"
    add_check_constraint :checkouts, "char_length(idempotency_key) BETWEEN 8 AND 80", name: "checkouts_key_length_check"

    create_table :payments do |t|
      t.references :checkout, null: false, foreign_key: true
      t.string :provider, null: false
      t.string :status, null: false, default: "pending"
      t.bigint :amount_cents, null: false
      t.string :provider_ref
      t.datetime :paid_at
      t.timestamps
    end
    add_check_constraint :payments, "provider IN ('stub')", name: "payments_provider_check"
    add_check_constraint :payments, "status IN ('pending', 'paid', 'failed')", name: "payments_status_check"
    add_check_constraint :payments, "amount_cents >= 0", name: "payments_amount_check"

    change_table :bookings, bulk: true do |t|
      t.string :reference
      t.integer :guests
      t.references :checkout, foreign_key: true
      t.references :trip_item, foreign_key: { on_delete: :nullify }, index: false
      t.references :payment, foreign_key: true
      t.jsonb :price_breakdown, null: false, default: {}
      t.integer :commission_bps, null: false, default: 0
      t.bigint :commission_cents, null: false, default: 0
      t.string :cancellation_policy
      t.string :booking_mode
      t.datetime :expires_at
      t.datetime :responded_at
      t.datetime :confirmed_at
      t.datetime :cancelled_at
      t.string :cancelled_by
      t.text :cancellation_reason
      t.bigint :refund_cents
    end
    # Offline bookings made before this get a reference too.
    reversible do |dir|
      dir.up do
        execute "UPDATE bookings SET reference = 'BK' || upper(substr(md5(random()::text || id::text), 1, 8))"
      end
    end
    change_column_null :bookings, :reference, false
    add_index :bookings, :reference, unique: true
    add_index :bookings, :trip_item_id, unique: true, where: "status IN (#{HOLDING.map { "'#{_1}'" }.join(', ')})",
      name: "index_bookings_on_trip_item_id_holding"
    add_index :bookings, %i[status expires_at]
    add_check_constraint :bookings, "guests >= 1 AND guests <= 100", name: "bookings_guests_check"
    add_check_constraint :bookings, "commission_bps >= 0 AND commission_bps <= 10000", name: "bookings_commission_bps_check"
    add_check_constraint :bookings, "commission_cents >= 0 AND commission_cents <= total_cents",
      name: "bookings_commission_check"
    add_check_constraint :bookings, "refund_cents >= 0 AND refund_cents <= total_cents", name: "bookings_refund_check"
    add_check_constraint :bookings, "booking_mode IN ('instant', 'request')", name: "bookings_booking_mode_check"
    add_check_constraint :bookings, "cancelled_by IN ('guest', 'partner', 'system')", name: "bookings_cancelled_by_check"
    add_check_constraint :bookings, "char_length(cancellation_reason) <= 500", name: "bookings_cancellation_reason_check"
    add_check_constraint :bookings, "source <> 'checkout' OR (user_id IS NOT NULL AND checkout_id IS NOT NULL)",
      name: "bookings_checkout_source_check"

    create_table :booking_events do |t|
      t.references :booking, null: false, foreign_key: true
      t.enum :from_status, enum_type: :booking_status
      t.enum :to_status, enum_type: :booking_status, null: false
      t.string :actor, null: false
      t.references :user, foreign_key: true, index: false
      t.text :reason
      t.jsonb :metadata, null: false, default: {}
      t.datetime :created_at, null: false
    end
    add_check_constraint :booking_events, "actor IN ('guest', 'partner', 'system')", name: "booking_events_actor_check"
  end
end
