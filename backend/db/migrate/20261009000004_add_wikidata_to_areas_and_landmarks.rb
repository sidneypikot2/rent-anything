# Wikidata enrichment (RAA-62): `rails gazetteer:wikidata` matches published areas and
# landmarks to their Wikidata item and stores its labels and aliases (en, tl, ceb; CC0) and
# a starting popularity. They sit beside the curated `aliases`, so a re-run replaces only
# Wikidata's terms and never an admin's. search_terms v2 reads both.
class AddWikidataToAreasAndLandmarks < ActiveRecord::Migration[8.1]
  def change
    %i[areas landmarks].each do |table|
      add_column table, :wikidata_id, :string
      add_column table, :wikidata_aliases, :string, array: true, null: false, default: []
      add_column table, :wikidata_popularity, :integer, null: false, default: 0
      add_index table, :wikidata_id, unique: true, where: "wikidata_id IS NOT NULL"
      add_check_constraint table, "wikidata_id ~ '^Q[0-9]+$'", name: "#{table}_wikidata_id_check"
      add_check_constraint table, "wikidata_popularity >= 0", name: "#{table}_wikidata_popularity_check"
    end

    update_view :search_terms, version: 2, revert_to_version: 1, materialized: true
  end
end
