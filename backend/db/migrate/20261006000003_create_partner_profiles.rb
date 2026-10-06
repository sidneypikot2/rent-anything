# Partner profile (RAA-40): a partner's legal name and business address, one row per
# partner user. The phone stays on users. Every field but display_name is required.
# user_role is always 'partner': with the composite foreign key to users (id, role) it
# makes the database refuse a profile for a guest or an admin, as on listings.
class CreatePartnerProfiles < ActiveRecord::Migration[8.1]
  def change
    create_table :partner_profiles do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.string :user_role, null: false, default: "partner"
      t.string :display_name
      t.string :legal_first_name, null: false
      t.string :legal_last_name, null: false
      t.string :street, null: false
      t.string :city, null: false
      t.string :region, null: false
      t.string :postal_code, null: false
      t.string :country, limit: 2, null: false, default: "PH"
      t.timestamps
    end
    add_check_constraint :partner_profiles, "user_role = 'partner'", name: "partner_profiles_user_role_check"
    add_check_constraint :partner_profiles, "country ~ '^[A-Z]{2}$'", name: "partner_profiles_country_check"
    add_foreign_key :partner_profiles, :users, column: [ :user_id, :user_role ], primary_key: [ :id, :role ],
      name: "fk_partner_profiles_user_role"
  end
end
