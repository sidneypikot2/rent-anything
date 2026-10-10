# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_10_000003) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "btree_gist"
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pg_trgm"
  enable_extension "postgis"
  enable_extension "unaccent"

  create_table "areas", force: :cascade do |t|
    t.bigint "parent_id"
    t.string "kind", null: false
    t.string "slug", null: false
    t.string "name", null: false
    t.string "aliases", default: [], null: false, array: true
    t.geography "center", limit: {srid: 4326, type: "st_point", geographic: true}, null: false
    t.geography "boundary", limit: {srid: 4326, type: "multi_polygon", geographic: true}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "psgc_code", limit: 10
    t.string "status", default: "draft", null: false
    t.string "wikidata_id"
    t.string "wikidata_aliases", default: [], null: false, array: true
    t.integer "wikidata_popularity", default: 0, null: false
    t.index ["boundary"], name: "index_areas_on_boundary", using: :gist
    t.index ["center"], name: "index_areas_on_center", using: :gist
    t.index ["parent_id"], name: "index_areas_on_parent_id"
    t.index ["psgc_code"], name: "index_areas_on_psgc_code", unique: true, where: "(psgc_code IS NOT NULL)"
    t.index ["slug"], name: "index_areas_on_slug", unique: true
    t.index ["status"], name: "index_areas_on_status"
    t.index ["wikidata_id"], name: "index_areas_on_wikidata_id", unique: true, where: "(wikidata_id IS NOT NULL)"
    t.check_constraint "kind::text = ANY (ARRAY['region'::character varying::text, 'province'::character varying::text, 'city'::character varying::text, 'town'::character varying::text, 'island'::character varying::text])", name: "areas_kind_check"
    t.check_constraint "psgc_code::text ~ '^[0-9]{10}$'::text", name: "areas_psgc_code_check"
    t.check_constraint "status::text = ANY (ARRAY['draft'::character varying::text, 'published'::character varying::text])", name: "areas_status_check"
    t.check_constraint "wikidata_id::text ~ '^Q[0-9]+$'::text", name: "areas_wikidata_id_check"
    t.check_constraint "wikidata_popularity >= 0", name: "areas_wikidata_popularity_check"
  end

  create_table "categories", force: :cascade do |t|
    t.bigint "parent_id"
    t.string "slug", null: false
    t.string "name", null: false
    t.string "booking_type"
    t.jsonb "attribute_schema", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "description", default: "", null: false
    t.index ["parent_id"], name: "index_categories_on_parent_id"
    t.index ["slug"], name: "index_categories_on_slug", unique: true
    t.check_constraint "booking_type::text = ANY (ARRAY['rental'::character varying::text, 'stay'::character varying::text, 'activity'::character varying::text, 'transfer'::character varying::text])", name: "categories_booking_type_check"
  end

  create_table "category_tags", primary_key: ["category_id", "tag_id"], force: :cascade do |t|
    t.bigint "category_id", null: false
    t.bigint "tag_id", null: false
    t.integer "weight", limit: 2, default: 1, null: false
    t.index ["tag_id"], name: "index_category_tags_on_tag_id"
    t.check_constraint "weight >= 1 AND weight <= 3", name: "category_tags_weight_check"
  end

  create_table "destination_links", force: :cascade do |t|
    t.string "source_type", null: false
    t.bigint "source_id", null: false
    t.string "target_type", null: false
    t.bigint "target_id", null: false
    t.string "kind", null: false
    t.integer "weight", limit: 2, default: 1, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["source_type", "source_id", "target_type", "target_id"], name: "index_destination_links_on_pair", unique: true
    t.index ["target_type", "target_id"], name: "index_destination_links_on_target_type_and_target_id"
    t.check_constraint "(ROW(source_type::text, source_id) < ROW(target_type::text, target_id))", name: "destination_links_order_check"
    t.check_constraint "(source_type::text = ANY (ARRAY['Area'::character varying::text, 'Landmark'::character varying::text])) AND (target_type::text = ANY (ARRAY['Area'::character varying::text, 'Landmark'::character varying::text]))", name: "destination_links_types_check"
    t.check_constraint "kind::text = ANY (ARRAY['bundled'::character varying::text, 'adjacent'::character varying::text])", name: "destination_links_kind_check"
    t.check_constraint "weight >= 1 AND weight <= 3", name: "destination_links_weight_check"
  end

  create_table "guest_profiles", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "user_role", default: "guest", null: false
    t.string "legal_first_name", null: false
    t.string "legal_last_name", null: false
    t.string "street", null: false
    t.string "city", null: false
    t.string "region", null: false
    t.string "province"
    t.string "postal_code", null: false
    t.string "country", limit: 2, default: "PH", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_guest_profiles_on_user_id", unique: true
    t.check_constraint "country::text ~ '^[A-Z]{2}$'::text", name: "guest_profiles_country_check"
    t.check_constraint "user_role::text = 'guest'::text", name: "guest_profiles_user_role_check"
  end

  create_table "landmark_tags", primary_key: ["landmark_id", "tag_id"], force: :cascade do |t|
    t.bigint "landmark_id", null: false
    t.bigint "tag_id", null: false
    t.index ["tag_id"], name: "index_landmark_tags_on_tag_id"
  end

  create_table "landmarks", force: :cascade do |t|
    t.bigint "area_id", null: false
    t.string "slug", null: false
    t.string "name", null: false
    t.string "aliases", default: [], null: false, array: true
    t.geography "location", limit: {srid: 4326, type: "st_point", geographic: true}, null: false
    t.text "description", default: "", null: false
    t.string "status", default: "draft", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "wikidata_id"
    t.string "wikidata_aliases", default: [], null: false, array: true
    t.integer "wikidata_popularity", default: 0, null: false
    t.index ["area_id"], name: "index_landmarks_on_area_id"
    t.index ["location"], name: "index_landmarks_on_location", using: :gist
    t.index ["slug"], name: "index_landmarks_on_slug", unique: true
    t.index ["wikidata_id"], name: "index_landmarks_on_wikidata_id", unique: true, where: "(wikidata_id IS NOT NULL)"
    t.check_constraint "status::text = ANY (ARRAY['draft'::character varying::text, 'published'::character varying::text])", name: "landmarks_status_check"
    t.check_constraint "wikidata_id::text ~ '^Q[0-9]+$'::text", name: "landmarks_wikidata_id_check"
    t.check_constraint "wikidata_popularity >= 0", name: "landmarks_wikidata_popularity_check"
  end

  create_table "listing_landmarks", primary_key: ["listing_id", "landmark_id"], force: :cascade do |t|
    t.bigint "listing_id", null: false
    t.bigint "landmark_id", null: false
    t.string "relation", default: "visits", null: false
    t.index ["landmark_id"], name: "index_listing_landmarks_on_landmark_id"
    t.check_constraint "relation::text = ANY (ARRAY['visits'::character varying::text, 'serves'::character varying::text])", name: "listing_landmarks_relation_check"
  end

  create_table "listings", force: :cascade do |t|
    t.bigint "area_id", null: false
    t.bigint "partner_id", null: false
    t.string "partner_role", default: "partner", null: false
    t.bigint "category_id", null: false
    t.string "title", null: false
    t.text "description", default: "", null: false
    t.geography "location", limit: {srid: 4326, type: "st_point", geographic: true}, null: false
    t.string "status", default: "draft", null: false
    t.jsonb "attrs", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "street"
    t.string "city"
    t.string "region"
    t.string "province"
    t.string "postal_code"
    t.string "country", limit: 2, default: "PH", null: false
    t.index ["area_id"], name: "index_listings_on_area_id"
    t.index ["category_id"], name: "index_listings_on_category_id"
    t.index ["location"], name: "index_listings_on_location", using: :gist
    t.index ["partner_id"], name: "index_listings_on_partner_id"
    t.index ["status"], name: "index_listings_on_status"
    t.check_constraint "country::text ~ '^[A-Z]{2}$'::text", name: "listings_country_check"
    t.check_constraint "partner_role::text = 'partner'::text", name: "listings_partner_role_check"
    t.check_constraint "status::text = ANY (ARRAY['draft'::character varying::text, 'pending'::character varying::text, 'active'::character varying::text])", name: "listings_status_check"
  end

  create_table "oauth_identities", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "provider", null: false
    t.string "uid", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "role", null: false
    t.index ["provider", "uid", "role"], name: "index_oauth_identities_on_provider_and_uid_and_role", unique: true
    t.index ["user_id"], name: "index_oauth_identities_on_user_id"
    t.check_constraint "provider::text = ANY (ARRAY['google'::character varying::text, 'facebook'::character varying::text])", name: "oauth_identities_provider_check"
  end

  create_table "partner_profiles", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "user_role", default: "partner", null: false
    t.string "display_name"
    t.string "legal_first_name", null: false
    t.string "legal_last_name", null: false
    t.string "street", null: false
    t.string "city", null: false
    t.string "region", null: false
    t.string "province"
    t.string "postal_code", null: false
    t.string "country", limit: 2, default: "PH", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_partner_profiles_on_user_id", unique: true
    t.check_constraint "country::text ~ '^[A-Z]{2}$'::text", name: "partner_profiles_country_check"
    t.check_constraint "user_role::text = 'partner'::text", name: "partner_profiles_user_role_check"
  end

  create_table "partner_verifications", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "user_role", default: "partner", null: false
    t.string "didit_session_id"
    t.string "status", default: "not_started", null: false
    t.integer "declined_count", default: 0, null: false
    t.datetime "last_declined_at"
    t.datetime "verified_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["didit_session_id"], name: "index_partner_verifications_on_didit_session_id", unique: true
    t.index ["user_id"], name: "index_partner_verifications_on_user_id", unique: true
    t.check_constraint "declined_count >= 0", name: "partner_verifications_declined_count_check"
    t.check_constraint "status::text = ANY (ARRAY['not_started'::character varying::text, 'in_progress'::character varying::text, 'in_review'::character varying::text, 'approved'::character varying::text, 'declined'::character varying::text, 'expired'::character varying::text])", name: "partner_verifications_status_check"
    t.check_constraint "user_role::text = 'partner'::text", name: "partner_verifications_user_role_check"
  end

  create_table "refresh_tokens", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "token_digest", null: false
    t.datetime "expires_at", null: false
    t.datetime "revoked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["token_digest"], name: "index_refresh_tokens_on_token_digest", unique: true
    t.index ["user_id"], name: "index_refresh_tokens_on_user_id"
  end

  create_table "search_events", force: :cascade do |t|
    t.string "query_normalized", limit: 100, null: false
    t.integer "result_count", null: false
    t.string "target_type"
    t.bigint "target_id"
    t.string "session_hash", limit: 64, null: false
    t.datetime "created_at", null: false
    t.index ["created_at"], name: "index_search_events_on_created_at"
    t.index ["session_hash"], name: "index_search_events_on_session_hash"
    t.index ["target_type", "target_id"], name: "index_search_events_on_target_type_and_target_id"
    t.check_constraint "(target_type IS NULL) = (target_id IS NULL)", name: "search_events_target_check"
    t.check_constraint "result_count >= 0", name: "search_events_result_count_check"
    t.check_constraint "session_hash::text ~ '^[0-9a-f]{64}$'::text", name: "search_events_session_hash_check"
    t.check_constraint "target_type::text = ANY (ARRAY['Area'::character varying::text, 'Landmark'::character varying::text, 'Tag'::character varying::text, 'Listing'::character varying::text])", name: "search_events_target_type_check"
  end

  create_table "tags", force: :cascade do |t|
    t.string "slug", null: false
    t.string "name", null: false
    t.string "aliases", default: [], null: false, array: true
    t.string "kind", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["slug"], name: "index_tags_on_slug", unique: true
    t.check_constraint "kind::text = ANY (ARRAY['activity'::character varying::text, 'feature'::character varying::text, 'theme'::character varying::text])", name: "tags_kind_check"
  end

  create_table "trip_items", force: :cascade do |t|
    t.bigint "trip_id", null: false
    t.bigint "listing_id", null: false
    t.date "starts_on"
    t.date "ends_on"
    t.integer "quantity", default: 1, null: false
    t.boolean "followed_suggestion"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["listing_id"], name: "index_trip_items_on_listing_id"
    t.index ["trip_id"], name: "index_trip_items_on_trip_id"
    t.check_constraint "(starts_on IS NULL) = (ends_on IS NULL)", name: "trip_items_dates_both_or_neither_check"
    t.check_constraint "ends_on >= starts_on", name: "trip_items_dates_order_check"
    t.check_constraint "quantity >= 1 AND quantity <= 99", name: "trip_items_quantity_check"
  end

  create_table "trips", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "name", null: false
    t.date "starts_on"
    t.date "ends_on"
    t.integer "guests", default: 1, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "updated_at"], name: "index_trips_on_user_id_and_updated_at"
    t.check_constraint "(starts_on IS NULL) = (ends_on IS NULL)", name: "trips_dates_both_or_neither_check"
    t.check_constraint "char_length(name::text) >= 1 AND char_length(name::text) <= 80", name: "trips_name_length_check"
    t.check_constraint "ends_on >= starts_on", name: "trips_dates_order_check"
    t.check_constraint "guests >= 1 AND guests <= 50", name: "trips_guests_check"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", null: false
    t.string "name"
    t.string "phone"
    t.string "password_digest"
    t.string "role", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "registration_complete", default: false, null: false
    t.index ["email", "role"], name: "index_users_on_email_and_role", unique: true
    t.index ["id", "role"], name: "index_users_on_id_and_role", unique: true
    t.check_constraint "NOT registration_complete OR name IS NOT NULL AND phone IS NOT NULL", name: "users_registration_complete_check"
    t.check_constraint "email::text = lower(email::text)", name: "users_email_lowercase_check"
    t.check_constraint "role::text = ANY (ARRAY['guest'::character varying::text, 'partner'::character varying::text, 'admin'::character varying::text])", name: "users_role_check"
  end

  add_foreign_key "areas", "areas", column: "parent_id"
  add_foreign_key "categories", "categories", column: "parent_id"
  add_foreign_key "category_tags", "categories"
  add_foreign_key "category_tags", "tags"
  add_foreign_key "guest_profiles", "users"
  add_foreign_key "guest_profiles", "users", column: ["user_id", "user_role"], primary_key: ["id", "role"], name: "fk_guest_profiles_user_role"
  add_foreign_key "landmark_tags", "landmarks"
  add_foreign_key "landmark_tags", "tags"
  add_foreign_key "landmarks", "areas"
  add_foreign_key "listing_landmarks", "landmarks"
  add_foreign_key "listing_landmarks", "listings"
  add_foreign_key "listings", "areas"
  add_foreign_key "listings", "categories"
  add_foreign_key "listings", "users", column: "partner_id"
  add_foreign_key "listings", "users", column: ["partner_id", "partner_role"], primary_key: ["id", "role"], name: "fk_listings_partner_role"
  add_foreign_key "oauth_identities", "users"
  add_foreign_key "oauth_identities", "users", column: ["user_id", "role"], primary_key: ["id", "role"], name: "fk_oauth_identities_user_role"
  add_foreign_key "partner_profiles", "users"
  add_foreign_key "partner_profiles", "users", column: ["user_id", "user_role"], primary_key: ["id", "role"], name: "fk_partner_profiles_user_role"
  add_foreign_key "partner_verifications", "users"
  add_foreign_key "partner_verifications", "users", column: ["user_id", "user_role"], primary_key: ["id", "role"], name: "fk_partner_verifications_user_role"
  add_foreign_key "refresh_tokens", "users"
  add_foreign_key "trip_items", "listings", on_delete: :cascade
  add_foreign_key "trip_items", "trips", on_delete: :cascade
  add_foreign_key "trips", "users"

  create_view "search_terms", materialized: true, sql_definition: <<-SQL
      WITH RECURSIVE area_tree(ancestor_id, area_id) AS (
           SELECT areas.id,
              areas.id
             FROM areas
            WHERE ((areas.status)::text = 'published'::text)
          UNION
           SELECT area_tree.ancestor_id,
              children.id
             FROM (areas children
               JOIN area_tree ON ((children.parent_id = area_tree.area_id)))
            WHERE ((children.status)::text = 'published'::text)
          ), picks AS (
           SELECT search_events.target_type,
              search_events.target_id,
              count(*) AS picks
             FROM search_events
            WHERE ((search_events.target_id IS NOT NULL) AND (search_events.created_at > (now() - 'P90D'::interval)))
            GROUP BY search_events.target_type, search_events.target_id
          ), area_popularity AS (
           SELECT area_tree.ancestor_id AS id,
              (count(DISTINCT listings.id) + count(DISTINCT landmarks.id)) AS score
             FROM ((area_tree
               LEFT JOIN listings ON (((listings.area_id = area_tree.area_id) AND ((listings.status)::text = 'active'::text))))
               LEFT JOIN landmarks ON (((landmarks.area_id = area_tree.area_id) AND ((landmarks.status)::text = 'published'::text))))
            GROUP BY area_tree.ancestor_id
          ), targets AS (
           SELECT 'Area'::text AS target_type,
              areas.id AS target_id,
              areas.name,
              (areas.aliases || areas.wikidata_aliases) AS aliases,
              (area_popularity.score + areas.wikidata_popularity) AS score
             FROM (areas
               JOIN area_popularity ON ((area_popularity.id = areas.id)))
            WHERE ((areas.status)::text = 'published'::text)
          UNION ALL
           SELECT 'Landmark'::text AS text,
              landmarks.id,
              landmarks.name,
              (landmarks.aliases || landmarks.wikidata_aliases),
              (( SELECT count(*) AS count
                     FROM (listing_landmarks
                       JOIN listings ON ((listings.id = listing_landmarks.listing_id)))
                    WHERE ((listing_landmarks.landmark_id = landmarks.id) AND ((listings.status)::text = 'active'::text))) + landmarks.wikidata_popularity)
             FROM landmarks
            WHERE ((landmarks.status)::text = 'published'::text)
          UNION ALL
           SELECT 'Tag'::text AS text,
              tags.id,
              tags.name,
              tags.aliases,
              ( SELECT count(*) AS count
                     FROM (landmark_tags
                       JOIN landmarks ON ((landmarks.id = landmark_tags.landmark_id)))
                    WHERE ((landmark_tags.tag_id = tags.id) AND ((landmarks.status)::text = 'published'::text))) AS count
             FROM tags
          ), terms AS (
           SELECT targets.target_type,
              targets.target_id,
              targets.name AS term,
              'name'::text AS kind,
              2 AS weight,
              targets.score
             FROM targets
          UNION ALL
           SELECT targets.target_type,
              targets.target_id,
              alias_name.alias_name,
              'alias'::text AS text,
              1,
              targets.score
             FROM targets,
              LATERAL unnest(targets.aliases) alias_name(alias_name)
          )
   SELECT unaccent(lower((terms.term)::text)) AS term_normalized,
      min((terms.term)::text) AS term,
      terms.target_type,
      terms.target_id,
      terms.kind,
      max(terms.weight) AS weight,
      ((max(terms.score) + COALESCE(max(picks.picks), (0)::bigint)))::integer AS popularity
     FROM (terms
       LEFT JOIN picks ON ((((picks.target_type)::text = terms.target_type) AND (picks.target_id = terms.target_id))))
    WHERE (btrim((terms.term)::text) <> ''::text)
    GROUP BY (unaccent(lower((terms.term)::text))), terms.target_type, terms.target_id, terms.kind;
  SQL
  add_index "search_terms", ["target_type", "target_id", "kind", "term_normalized"], name: "index_search_terms_on_target_and_term", unique: true
  add_index "search_terms", ["term_normalized"], name: "index_search_terms_on_term_normalized", opclass: :gin_trgm_ops, using: :gin

end
