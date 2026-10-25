# Guest trips without an account (RAA-175): a guest can build a trip before giving an email
# (they give name, email and phone at their first checkout), and comes back through a trip
# link protected by a PIN, or an emailed one-time code.
class CreateGuestTripAccess < ActiveRecord::Migration[8.1]
  def change
    # Only a guest who hasn't checked out yet has no email.
    change_column_null :users, :email, true
    add_check_constraint :users, "email IS NOT NULL OR (role = 'guest' AND NOT registration_complete)",
      name: "users_email_presence_check"

    # One trip link and PIN per guest; both stored only as digests.
    create_table :trip_accesses do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.string :token_digest, null: false, index: { unique: true }
      t.string :pin_digest, null: false
      t.integer :failed_attempts, null: false, default: 0
      t.datetime :locked_at
      t.datetime :rotated_at
      t.timestamps
      t.check_constraint "failed_attempts >= 0", name: "trip_accesses_failed_attempts_check"
    end

    # Emailed one-time codes: recovery, and proving an email another guest already has.
    create_table :sign_in_codes do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string :code_digest, null: false
      t.datetime :expires_at, null: false
      t.integer :attempts, null: false, default: 0
      t.datetime :consumed_at
      t.timestamps
      t.check_constraint "attempts >= 0", name: "sign_in_codes_attempts_check"
    end

    # A trip link's session lasts one open: its refresh token keeps its first expiry when
    # rotated, instead of starting another 30 days.
    add_column :refresh_tokens, :fixed_expiry, :boolean, null: false, default: false
  end
end
