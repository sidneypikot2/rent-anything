# Auth & accounts (RAA-22): users with a role, and the refresh tokens that renew their
# short-lived access tokens. Only a refresh token's SHA-256 digest is stored.
class CreateUsersAndRefreshTokens < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :name, null: false
      t.string :email, null: false
      t.string :phone
      t.string :password_digest, null: false
      t.string :role, null: false, default: "guest"
      t.timestamps

      t.index :email, unique: true
      t.check_constraint "role IN ('guest', 'partner', 'admin')", name: "users_role_check"
    end

    create_table :refresh_tokens do |t|
      t.references :user, null: false, foreign_key: true, index: true
      t.string :token_digest, null: false
      t.datetime :expires_at, null: false
      t.datetime :revoked_at
      t.timestamps

      t.index :token_digest, unique: true
    end
  end
end
