# Foundation (RAA-1): PostGIS for listing locations and area boundaries (geography
# columns, ST_DWithin search), btree_gist for the bookings no-overlap exclusion constraint.
class EnablePostgis < ActiveRecord::Migration[8.1]
  def change
    enable_extension "postgis"
    enable_extension "btree_gist"
  end
end
