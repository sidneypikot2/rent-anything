# Deleting unregistered guests' trips 60 days after they end (RAA-175, Guests::Purge). The
# guest user goes with their last trip, but partners keep the bookings, checkouts, payments
# and booking history: each booking keeps its own copy of the guest's contact details, and
# the links to the user become null.
class KeepBookingsAfterGuestPurge < ActiveRecord::Migration[8.1]
  def up
    add_column :bookings, :guest_email, :string
    add_column :bookings, :guest_phone, :string
    execute <<~SQL
      UPDATE bookings SET guest_email = users.email, guest_phone = users.phone
      FROM users WHERE users.id = bookings.user_id AND bookings.source = 'checkout'
    SQL

    change_column_null :checkouts, :user_id, true
    %i[bookings checkouts booking_events].each do |table|
      remove_foreign_key table, :users
      add_foreign_key table, :users, on_delete: :nullify
    end

    remove_check_constraint :bookings, name: "bookings_checkout_source_check"
    add_check_constraint :bookings, "source <> 'checkout' OR checkout_id IS NOT NULL", name: "bookings_checkout_source_check"

    # When the reminder 7 days before the purge was sent; once per trip.
    add_column :trips, :purge_reminded_at, :datetime
  end

  def down
    remove_column :trips, :purge_reminded_at

    remove_check_constraint :bookings, name: "bookings_checkout_source_check"
    add_check_constraint :bookings, "source <> 'checkout' OR user_id IS NOT NULL AND checkout_id IS NOT NULL",
      name: "bookings_checkout_source_check"

    %i[bookings checkouts booking_events].each do |table|
      remove_foreign_key table, :users
      add_foreign_key table, :users
    end
    change_column_null :checkouts, :user_id, false

    remove_column :bookings, :guest_phone
    remove_column :bookings, :guest_email
  end
end
