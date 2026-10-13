# Partner businesses (RAA-100): one partner account can run several businesses (a guest
# house and a motorbike rental), and each listing belongs to one of its partner's. Guests see
# the business name. ID checks and payouts stay with the partner. The composite foreign key
# keeps a listing on a business of its own partner. Existing partners with listings or a
# display name get one business holding all their listings, named after the display name,
# else the legal first name (never the surname), else the account name (the sample partners
# have no profile), else "Local partner". db/seeds.rb runs the same backfill for a database
# loaded from schema.rb.
class CreateBusinesses < ActiveRecord::Migration[8.1]
  def self.backfill(connection)
    connection.execute <<~SQL
      INSERT INTO businesses (partner_id, name, created_at, updated_at)
      SELECT users.id,
             left(coalesce(nullif(trim(partner_profiles.display_name), ''), partner_profiles.legal_first_name,
               nullif(trim(users.name), ''), 'Local partner'), 80),
             now(), now()
      FROM users
      LEFT JOIN partner_profiles ON partner_profiles.user_id = users.id
      WHERE users.role = 'partner'
        AND NOT EXISTS (SELECT 1 FROM businesses WHERE businesses.partner_id = users.id)
        AND (EXISTS (SELECT 1 FROM listings WHERE listings.partner_id = users.id)
             OR nullif(trim(partner_profiles.display_name), '') IS NOT NULL)
    SQL
    connection.execute <<~SQL
      UPDATE listings SET business_id = (
        SELECT min(businesses.id) FROM businesses WHERE businesses.partner_id = listings.partner_id
      )
      WHERE business_id IS NULL
    SQL
  end

  def up
    create_table :businesses do |t|
      t.references :partner, null: false, foreign_key: { to_table: :users }
      t.string :name, null: false
      t.text :description, default: "", null: false
      t.timestamps
    end
    add_index :businesses, "partner_id, lower(name)", unique: true, name: "index_businesses_on_partner_id_and_lower_name"
    add_index :businesses, %i[id partner_id], unique: true
    add_check_constraint :businesses, "char_length(name) BETWEEN 1 AND 80", name: "businesses_name_length_check"

    add_reference :listings, :business, foreign_key: true
    add_foreign_key :listings, :businesses, column: %i[business_id partner_id], primary_key: %i[id partner_id],
      name: "fk_listings_business_partner"

    self.class.backfill(connection)
    change_column_null :listings, :business_id, false
  end

  def down
    remove_foreign_key :listings, name: "fk_listings_business_partner"
    remove_reference :listings, :business, foreign_key: true
    drop_table :businesses
  end
end
