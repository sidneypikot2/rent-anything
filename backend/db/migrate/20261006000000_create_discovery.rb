# Guest discovery (RAA-33): where a guest can go (areas, a tree from region down to town
# or island), what they visit there (landmarks), what they do (tags), and what they can
# book (listings in a category tree). Tags reach listings only through their category
# (category_tags, admin-curated), never from the partner. pg_trgm and unaccent back the
# typo- and accent-tolerant search.
class CreateDiscovery < ActiveRecord::Migration[8.1]
  def change
    enable_extension "pg_trgm"
    enable_extension "unaccent"

    create_table :areas do |t|
      t.references :parent, foreign_key: { to_table: :areas }
      t.string :kind, null: false
      t.string :slug, null: false
      t.string :name, null: false
      t.string :aliases, array: true, null: false, default: []
      t.st_point :center, geographic: true, null: false
      t.multi_polygon :boundary, geographic: true
      t.timestamps
    end
    add_index :areas, :slug, unique: true
    add_index :areas, :center, using: :gist
    add_index :areas, :boundary, using: :gist
    add_check_constraint :areas, "kind IN ('region', 'province', 'city', 'town', 'island')", name: "areas_kind_check"

    create_table :landmarks do |t|
      t.references :area, null: false, foreign_key: true
      t.string :slug, null: false
      t.string :name, null: false
      t.string :aliases, array: true, null: false, default: []
      t.st_point :location, geographic: true, null: false
      t.text :description, null: false, default: ""
      t.string :status, null: false, default: "draft"
      t.timestamps
    end
    add_index :landmarks, :slug, unique: true
    add_index :landmarks, :location, using: :gist
    add_check_constraint :landmarks, "status IN ('draft', 'published')", name: "landmarks_status_check"

    create_table :tags do |t|
      t.string :slug, null: false
      t.string :name, null: false
      t.string :aliases, array: true, null: false, default: []
      t.string :kind, null: false
      t.timestamps
    end
    add_index :tags, :slug, unique: true
    add_check_constraint :tags, "kind IN ('activity', 'feature', 'theme')", name: "tags_kind_check"

    create_table :categories do |t|
      t.references :parent, foreign_key: { to_table: :categories }
      t.string :slug, null: false
      t.string :name, null: false
      t.string :booking_type
      t.jsonb :attribute_schema, null: false, default: {}
      t.timestamps
    end
    add_index :categories, :slug, unique: true
    add_check_constraint :categories, "booking_type IN ('rental', 'stay', 'activity', 'transfer')",
      name: "categories_booking_type_check"

    # partner_role is always 'partner': with the composite foreign key to users (id, role)
    # it makes the database refuse a listing owned by a guest or an admin.
    create_table :listings do |t|
      t.references :area, null: false, foreign_key: true
      t.references :partner, null: false, foreign_key: { to_table: :users }
      t.string :partner_role, null: false, default: "partner"
      t.references :category, null: false, foreign_key: true
      t.string :title, null: false
      t.text :description, null: false, default: ""
      t.st_point :location, geographic: true, null: false
      t.string :status, null: false, default: "draft"
      t.jsonb :attrs, null: false, default: {}
      t.timestamps
    end
    add_index :listings, :location, using: :gist
    add_index :listings, :status
    add_check_constraint :listings, "status IN ('draft', 'pending', 'active')", name: "listings_status_check"
    add_check_constraint :listings, "partner_role = 'partner'", name: "listings_partner_role_check"
    add_foreign_key :listings, :users, column: [ :partner_id, :partner_role ], primary_key: [ :id, :role ],
      name: "fk_listings_partner_role"

    create_table :landmark_tags, primary_key: [ :landmark_id, :tag_id ] do |t|
      t.references :landmark, null: false, foreign_key: true, index: false
      t.references :tag, null: false, foreign_key: true
    end

    create_table :category_tags, primary_key: [ :category_id, :tag_id ] do |t|
      t.references :category, null: false, foreign_key: true, index: false
      t.references :tag, null: false, foreign_key: true
      t.integer :weight, limit: 2, null: false, default: 1
    end
    add_check_constraint :category_tags, "weight BETWEEN 1 AND 3", name: "category_tags_weight_check"

    create_table :listing_landmarks, primary_key: [ :listing_id, :landmark_id ] do |t|
      t.references :listing, null: false, foreign_key: true, index: false
      t.references :landmark, null: false, foreign_key: true
      t.string :relation, null: false, default: "visits"
    end
    add_check_constraint :listing_landmarks, "relation IN ('visits', 'serves')", name: "listing_landmarks_relation_check"
  end
end
