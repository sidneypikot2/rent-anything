# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# Discovery sample data (RAA-33): Bantayan Island and Cebu City. It lives in a data
# migration so existing databases get it from db:migrate, but a new database is loaded
# from schema.rb, which skips data migrations, so it is loaded here when there is none.
# Not in test: specs build their own areas.
unless Rails.env.test? || Area.exists?
  require Rails.root.join("db/migrate/20261006000001_seed_discovery_sample_data").to_s
  SeedDiscoverySampleData.new.migrate(:up)
end

# Santa Fe sample partner (RAA-51), loaded the same way. It needs the areas and
# categories above.
unless Rails.env.test? || Area.exists?(slug: "santa-fe")
  require Rails.root.join("db/migrate/20261008000000_seed_santa_fe_sample_partner").to_s
  SeedSantaFeSamplePartner.new.migrate(:up)
end

# The data migrations above insert areas without a status, which a database built from
# schema.rb makes draft (RAA-59); a migrated one published them when the column was added.
# They are the sample destinations, so they are live either way.
unless Rails.env.test?
  require Rails.root.join("db/migrate/20261006000001_seed_discovery_sample_data").to_s
  Area.where(slug: SeedDiscoverySampleData::AREAS.map(&:first) + [ "santa-fe" ]).update_all(status: "published")
end
