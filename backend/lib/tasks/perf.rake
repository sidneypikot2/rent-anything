# A load-test place for What to book (/<area>/book): "Perf Test Island", a published island
# filled with copies of Bantayan Island's active listings — their rates, units, offers, add-ons,
# fees, details and inclusions, but not their photos (the copies would share the stored files) —
# ten to a business, scattered over the island. Plain SQL, so 50,000 listings take seconds;
# nothing runs it on deploy, and it refuses outside development.
#
#   bin/rails "perf:seed_place[50000]"   # build it (stops if it already exists)
#   bin/rails perf:remove_place          # delete it again
module PerfPlace
  SLUG = "perf-island".freeze
  SOURCE = "bantayan-island".freeze
  PER_BUSINESS = 10
  # A box of open sea east of Cebu, away from every real place.
  CENTER = [ 125.0, 10.0 ].freeze
  SPAN = 0.2
  # The tables hanging off a listing that a copy takes along.
  CHILDREN = %w[stay_rates vehicle_rates flat_rates tour_details tour_inclusions activity_details
                activity_offers activity_add_ons listing_units listing_fees].freeze

  def self.guard!
    abort "perf: development only" unless Rails.env.development?
  end

  def self.sql(statement, *binds) = ActiveRecord::Base.connection.execute(ActiveRecord::Base.sanitize_sql_array([ statement, *binds ]))

  def self.seed(count)
    guard!
    abort "perf: #{SLUG} already exists; run perf:remove_place first" if Area.exists?(slug: SLUG)
    source = Area.find_by!(slug: SOURCE)
    sources = Listing.where(status: "active").in_area_tree(source).order(:id).pluck(:id, :partner_id)
    abort "perf: #{SOURCE} has no active listings to copy" if sources.empty?

    started = Time.current
    ActiveRecord::Base.transaction do
      lng, lat = CENTER
      half = SPAN / 2
      box = "MULTIPOLYGON(((#{lng - half} #{lat - half}, #{lng + half} #{lat - half}, #{lng + half} #{lat + half}, #{lng - half} #{lat + half}, #{lng - half} #{lat - half})))"
      area_id = sql(<<~SQL, lng, lat, box).first["id"]
        INSERT INTO areas (kind, slug, name, center, boundary, status, tagline, created_at, updated_at)
        VALUES ('island', '#{SLUG}', 'Perf Test Island', ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
                ST_GeomFromText(?, 4326)::geography, 'published', 'Load-test data, not a real place', now(), now())
        RETURNING id
      SQL

      partner_id = sources.first.last
      businesses = (count.to_f / PER_BUSINESS).ceil
      sql(<<~SQL, partner_id, lng, half, lat, half, businesses)
        INSERT INTO businesses (partner_id, name, description, city, country, location, created_at, updated_at)
        SELECT ?, 'Perf Business ' || n, 'Load-test business.', 'Perf Town', 'PH',
               ST_SetSRID(ST_MakePoint(? + (random() * 2 - 1) * ?, ? + (random() * 2 - 1) * ?), 4326)::geography, now(), now()
        FROM generate_series(1, ?) AS n
      SQL
      first_business = ActiveRecord::Base.connection.select_value("SELECT MIN(id) FROM businesses WHERE name LIKE 'Perf Business %' AND city = 'Perf Town'")

      # Which listing each copy comes from, its new id and its business.
      sql("CREATE TEMP TABLE perf_map (n integer, src_id bigint, new_id bigint, business_id bigint) ON COMMIT DROP")
      sql(<<~SQL, sources.map(&:first), first_business, count)
        INSERT INTO perf_map (n, src_id, new_id, business_id)
        SELECT n, (ARRAY[?]::bigint[])[1 + (n - 1) % #{sources.size}], nextval('listings_id_seq'), ? + (n - 1) / #{PER_BUSINESS}
        FROM generate_series(1, ?) AS n
      SQL

      columns = ActiveRecord::Base.connection.columns("listings").map(&:name) - %w[id area_id business_id partner_id title location status street city]
      sql(<<~SQL, lng, half, lat, half)
        INSERT INTO listings (id, area_id, business_id, partner_id, title, location, status, city, #{columns.join(', ')})
        SELECT m.new_id, #{area_id.to_i}, m.business_id, #{partner_id.to_i}, l.title || ' ' || m.n,
               ST_SetSRID(ST_MakePoint(? + (random() * 2 - 1) * ?, ? + (random() * 2 - 1) * ?), 4326)::geography,
               'active', 'Perf Town', #{columns.map { "l.#{_1}" }.join(', ')}
        FROM perf_map m JOIN listings l ON l.id = m.src_id
      SQL

      CHILDREN.each do |table|
        copied = ActiveRecord::Base.connection.columns(table).map(&:name) - %w[id listing_id]
        sql(<<~SQL)
          INSERT INTO #{table} (listing_id, #{copied.join(', ')})
          SELECT m.new_id, #{copied.map { "c.#{_1}" }.join(', ')}
          FROM perf_map m JOIN #{table} c ON c.listing_id = m.src_id
        SQL
      end
    end
    puts "perf: #{count} listings in #{(count.to_f / PER_BUSINESS).ceil} businesses on /#{SLUG} in #{(Time.current - started).round(1)}s"
  end

  def self.remove
    guard!
    area = Area.find_by(slug: SLUG)
    return puts("perf: nothing to remove") unless area

    ActiveRecord::Base.transaction do
      ids = "SELECT id FROM listings WHERE area_id = #{area.id.to_i}"
      CHILDREN.reverse_each { |table| sql("DELETE FROM #{table} WHERE listing_id IN (#{ids})") }
      business_ids = "SELECT DISTINCT business_id FROM listings WHERE area_id = #{area.id.to_i}"
      sql("CREATE TEMP TABLE perf_businesses ON COMMIT DROP AS #{business_ids}")
      sql("DELETE FROM listings WHERE area_id = #{area.id.to_i}")
      sql("DELETE FROM businesses WHERE id IN (SELECT business_id FROM perf_businesses)")
      sql("DELETE FROM areas WHERE id = #{area.id.to_i}")
    end
    puts "perf: removed /#{SLUG}"
  end
end

namespace :perf do
  desc "Fill Perf Test Island with copies of Bantayan's listings (development only)"
  task :seed_place, [ :count ] => :environment do |_, args|
    PerfPlace.seed(Integer(args[:count] || 50_000))
  end

  desc "Delete Perf Test Island and everything on it (development only)"
  task remove_place: :environment do
    PerfPlace.remove
  end
end
