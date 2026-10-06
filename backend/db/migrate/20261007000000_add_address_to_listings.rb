# Listing address (RAA-41): where the listing is, as the partner writes it, next to the
# map point. Nullable because listings made before this have none; the model requires an
# address on every new listing. country is ISO 3166-1 alpha-2, as on the profiles.
class AddAddressToListings < ActiveRecord::Migration[8.1]
  def change
    change_table :listings, bulk: true do |t|
      t.string :street
      t.string :city
      t.string :region
      t.string :province
      t.string :postal_code
      t.string :country, limit: 2, null: false, default: "PH"
    end
    add_check_constraint :listings, "country ~ '^[A-Z]{2}$'", name: "listings_country_check"
  end
end
