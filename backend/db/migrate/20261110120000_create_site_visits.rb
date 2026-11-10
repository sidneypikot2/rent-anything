# Site visits (RAA-290): one row per browser per Manila day, for the admin overview's visitors.
# Only a digest of the browser's random id and the day is kept: no IP, no user agent, nothing
# that leads back to the browser or carries over from one day to the next.
class CreateSiteVisits < ActiveRecord::Migration[8.1]
  def change
    create_table :site_visits do |t|
      t.date :visited_on, null: false
      t.string :visitor_digest, null: false
      t.datetime :created_at, null: false
    end
    add_index :site_visits, %i[visited_on visitor_digest], unique: true
  end
end
