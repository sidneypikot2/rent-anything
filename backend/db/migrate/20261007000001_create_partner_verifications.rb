# Partner ID verification (RAA-44): one row per partner, tracking their Didit session. Didit
# holds the ID images and the check itself; we keep only the outcome. status is our own
# enum (PartnerVerification maps Didit's onto it). declined_count and last_declined_at drive
# the retry cooldown: after 3 declines a partner waits an hour before trying again.
# user_role is always 'partner': with the composite foreign key to users (id, role) the
# database refuses a verification for a guest or an admin, as on partner_profiles.
class CreatePartnerVerifications < ActiveRecord::Migration[8.1]
  def change
    create_table :partner_verifications do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.string :user_role, null: false, default: "partner"
      t.string :didit_session_id, index: { unique: true }
      t.string :status, null: false, default: "not_started"
      t.integer :declined_count, null: false, default: 0
      t.datetime :last_declined_at
      t.datetime :verified_at
      t.timestamps
    end
    add_check_constraint :partner_verifications, "user_role = 'partner'", name: "partner_verifications_user_role_check"
    add_check_constraint :partner_verifications,
      "status IN ('not_started', 'in_progress', 'in_review', 'approved', 'declined', 'expired')",
      name: "partner_verifications_status_check"
    add_check_constraint :partner_verifications, "declined_count >= 0",
      name: "partner_verifications_declined_count_check"
    add_foreign_key :partner_verifications, :users, column: [ :user_id, :user_role ], primary_key: [ :id, :role ],
      name: "fk_partner_verifications_user_role"
  end
end
