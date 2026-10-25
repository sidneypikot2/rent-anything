# A trip's view-only share link (RAA-176). Kept in plain text so the owner can copy the
# link again; rotating or revoking it ends the old link.
class AddShareTokenToTrips < ActiveRecord::Migration[8.1]
  def change
    add_column :trips, :share_token, :string
    add_index :trips, :share_token, unique: true
  end
end
