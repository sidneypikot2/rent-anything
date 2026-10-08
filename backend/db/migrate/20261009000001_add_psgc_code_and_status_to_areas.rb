# Gazetteer import (RAA-59): areas imported from the PSA's PSGC carry its 10-digit code,
# which the import upserts by. Every province, city and town is imported, but guests only
# see published ones, so an import adds them as drafts. Areas made by hand before the
# import are already live, so they are published here.
class AddPsgcCodeAndStatusToAreas < ActiveRecord::Migration[8.1]
  def change
    add_column :areas, :psgc_code, :string, limit: 10
    add_column :areas, :status, :string, null: false, default: "published"
    change_column_default :areas, :status, from: "published", to: "draft"
    add_index :areas, :psgc_code, unique: true, where: "psgc_code IS NOT NULL"
    add_index :areas, :status
    add_check_constraint :areas, "status IN ('draft', 'published')", name: "areas_status_check"
    add_check_constraint :areas, "psgc_code ~ '^[0-9]{10}$'", name: "areas_psgc_code_check"
  end
end
