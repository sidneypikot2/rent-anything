# Accounts and auth (RAA-23): one users table with a role (guest, partner, admin), the
# Google/Facebook identities linked to a user, and refresh tokens (stored as digests).
class CreateAccounts < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :name, null: false
      t.string :phone
      t.string :password_digest
      t.string :role, null: false
      t.timestamps
    end
    add_index :users, :email, unique: true
    add_check_constraint :users, "role IN ('guest', 'partner', 'admin')", name: "users_role_check"
    add_check_constraint :users, "email = lower(email)", name: "users_email_lowercase_check"

    create_table :oauth_identities do |t|
      t.references :user, null: false, foreign_key: true
      t.string :provider, null: false
      t.string :uid, null: false
      t.timestamps
    end
    add_index :oauth_identities, [ :provider, :uid ], unique: true
    add_check_constraint :oauth_identities, "provider IN ('google', 'facebook')",
      name: "oauth_identities_provider_check"

    create_table :refresh_tokens do |t|
      t.references :user, null: false, foreign_key: true
      t.string :token_digest, null: false
      t.datetime :expires_at, null: false
      t.datetime :revoked_at
      t.timestamps
    end
    add_index :refresh_tokens, :token_digest, unique: true
  end
end
