# Guest profile (RAA-40): a guest's legal name and address, one row per guest user, kept
# apart from partner_profiles because the two will need different fields. The phone stays
# on users; province is empty where there is none (Metro Manila). user_role is always
# 'guest': with the composite foreign key to users (id, role) it makes the database refuse
# a guest profile for a partner or an admin.
class CreateGuestProfiles < ActiveRecord::Migration[8.1]
  def change
    create_table :guest_profiles do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.string :user_role, null: false, default: "guest"
      t.string :legal_first_name, null: false
      t.string :legal_last_name, null: false
      t.string :street, null: false
      t.string :city, null: false
      t.string :region, null: false
      t.string :province
      t.string :postal_code, null: false
      t.string :country, limit: 2, null: false, default: "PH"
      t.timestamps
    end
    add_check_constraint :guest_profiles, "user_role = 'guest'", name: "guest_profiles_user_role_check"
    add_check_constraint :guest_profiles, "country ~ '^[A-Z]{2}$'", name: "guest_profiles_country_check"
    add_foreign_key :guest_profiles, :users, column: [ :user_id, :user_role ], primary_key: [ :id, :role ],
      name: "fk_guest_profiles_user_role"
  end
end
