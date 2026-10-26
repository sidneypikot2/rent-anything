# PayMongo hosted checkout (test mode only for now): one payment per pay request, which can
# cover bookings of several checkouts, so a payment belongs to the guest and its checkout is
# optional. A pending payment lists the bookings it covers (covered_booking_ids); they point
# at it only once it is paid. The checkout session is provider_ref (cs_...), the payment
# PayMongo made provider_payment_id (pay_...). needs_refund is a payment that came in after its
# bookings were let go. Like checkouts, a payment outlives a purged guest (RAA-175).
class AddPaymongoToPayments < ActiveRecord::Migration[8.1]
  def up
    add_reference :payments, :user, foreign_key: { on_delete: :nullify }
    execute "UPDATE payments SET user_id = checkouts.user_id FROM checkouts WHERE checkouts.id = payments.checkout_id"
    change_column_null :payments, :checkout_id, true

    change_table :payments, bulk: true do |t|
      t.string :checkout_url
      t.string :provider_payment_id
      t.bigint :covered_booking_ids, array: true, null: false, default: []
      t.boolean :livemode, null: false, default: false
      t.datetime :failed_at
    end
    add_index :payments, %i[provider provider_ref], unique: true
    add_index :payments, :covered_booking_ids, using: :gin

    remove_check_constraint :payments, name: "payments_provider_check"
    add_check_constraint :payments, "provider IN ('stub', 'paymongo')", name: "payments_provider_check"
    remove_check_constraint :payments, name: "payments_status_check"
    add_check_constraint :payments, "status IN ('pending', 'paid', 'failed', 'needs_refund')", name: "payments_status_check"
    # Live payments aren't allowed until payments go live (Paymongo.secret_key).
    add_check_constraint :payments, "NOT livemode", name: "payments_test_mode_check"
  end

  def down
    remove_check_constraint :payments, name: "payments_test_mode_check"
    remove_check_constraint :payments, name: "payments_status_check"
    add_check_constraint :payments, "status IN ('pending', 'paid', 'failed')", name: "payments_status_check"
    remove_check_constraint :payments, name: "payments_provider_check"
    add_check_constraint :payments, "provider IN ('stub')", name: "payments_provider_check"

    remove_index :payments, :covered_booking_ids
    remove_index :payments, %i[provider provider_ref]
    remove_columns :payments, :checkout_url, :provider_payment_id, :covered_booking_ids, :livemode, :failed_at
    change_column_null :payments, :checkout_id, false
    remove_reference :payments, :user
  end
end
