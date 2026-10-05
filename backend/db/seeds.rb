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
