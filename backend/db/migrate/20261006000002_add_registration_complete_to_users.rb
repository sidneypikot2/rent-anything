# Sign-up asks only for email and password (RAA-32); name and phone come after, on the
# complete-profile page. The flag says that step is done, and the database holds it to
# needing both. Accounts that already have both count as complete.
class AddRegistrationCompleteToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :registration_complete, :boolean, null: false, default: false
    change_column_null :users, :name, true
    up_only do
      execute <<~SQL
        UPDATE users SET registration_complete = TRUE WHERE name IS NOT NULL AND phone IS NOT NULL
      SQL
    end
    add_check_constraint :users, "NOT registration_complete OR (name IS NOT NULL AND phone IS NOT NULL)",
      name: "users_registration_complete_check"
  end
end
