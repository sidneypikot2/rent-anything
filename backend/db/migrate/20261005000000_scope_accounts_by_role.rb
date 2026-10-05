# Same email for a guest and a partner (RAA-29): email is unique per role, and a Google or
# Facebook account links to one user per role. An identity carries its user's role, held in
# step by a composite foreign key to users (id, role) — which also limits it to that
# column's CHECK values.
class ScopeAccountsByRole < ActiveRecord::Migration[8.1]
  def change
    remove_index :users, :email, unique: true
    add_index :users, [ :email, :role ], unique: true
    add_index :users, [ :id, :role ], unique: true

    add_column :oauth_identities, :role, :string
    up_only do
      execute <<~SQL
        UPDATE oauth_identities SET role = users.role FROM users WHERE users.id = oauth_identities.user_id
      SQL
    end
    change_column_null :oauth_identities, :role, false

    remove_index :oauth_identities, [ :provider, :uid ], unique: true
    add_index :oauth_identities, [ :provider, :uid, :role ], unique: true
    add_foreign_key :oauth_identities, :users, column: [ :user_id, :role ], primary_key: [ :id, :role ],
      name: "fk_oauth_identities_user_role"
  end
end
