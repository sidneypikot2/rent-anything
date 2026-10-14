# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# Listings belong to a business (RAA-100), but the sample-data loaders below insert listings
# without one. On a database loaded from schema.rb they run with business_id's NOT NULL
# lifted, then the RAA-100 backfill gives their partners a business and the constraint is
# restored, all in one transaction. The unit names (RAA-100) are filled the same way.
unless Rails.env.test?
  require Rails.root.join("db/migrate/20261013100000_add_unit_names_to_categories").to_s
  require Rails.root.join("db/migrate/20261013100001_create_businesses").to_s
  connection = ActiveRecord::Base.connection

  ActiveRecord::Base.transaction do
    connection.change_column_null :listings, :business_id, true

    # Discovery sample data (RAA-33): Bantayan Island and Cebu City. It lives in a data
    # migration so existing databases get it from db:migrate, but a new database is loaded
    # from schema.rb, which skips data migrations, so it is loaded here when there is none.
    # Not in test: specs build their own areas.
    unless Area.exists?
      require Rails.root.join("db/migrate/20261006000001_seed_discovery_sample_data").to_s
      SeedDiscoverySampleData.new.migrate(:up)
    end

    # Santa Fe sample partner (RAA-51), loaded the same way. It needs the areas and
    # categories above.
    unless Area.exists?(slug: "santa-fe")
      require Rails.root.join("db/migrate/20261008000000_seed_santa_fe_sample_partner").to_s
      SeedSantaFeSamplePartner.new.migrate(:up)
    end

    # Accommodation property types (RAA-82), loaded the same way. They need the categories above.
    unless Category.exists?(slug: "cottage")
      require Rails.root.join("db/migrate/20261010000003_add_accommodation_property_types").to_s
      AddAccommodationPropertyTypes.new.migrate(:up)
    end

    # Vehicle rental types (RAA-88), loaded the same way. They need the categories above.
    unless Category.exists?(slug: "van-rental")
      require Rails.root.join("db/migrate/20261011000002_add_vehicle_rental_types").to_s
      AddVehicleRentalTypes.new.migrate(:up)
    end

    # Rentals split into Vehicle rental and Equipment rental (RAA-88), loaded the same way.
    unless Category.exists?(slug: "equipment-rentals")
      require Rails.root.join("db/migrate/20261012000001_split_rentals_category").to_s
      SplitRentalsCategory.new.migrate(:up)
    end

    # Stay rooms by place type (RAA-94), loaded the same way. It needs the property types above.
    unless Category.where(slug: "hotel").where("attribute_schema -> 'properties' ? 'rooms'").exists?
      require Rails.root.join("db/migrate/20261012230000_add_stay_rooms").to_s
      AddStayRooms.new.migrate(:up)
    end

    # Fewer categories to start with (RAA-103): the loaders above still create the five it
    # removes, so it runs after them.
    if Category.exists?(slug: "photographer")
      require Rails.root.join("db/migrate/20261014200000_remove_unfocused_categories").to_s
      RemoveUnfocusedCategories.new.migrate(:up)
    end

    CreateBusinesses.backfill(connection)
    AddUnitNamesToCategories.fill(connection)
    connection.change_column_null :listings, :business_id, false
  end
end

# Every listing has at least one unit (RAA-98): the migration gave the existing ones theirs,
# and the sample listings above are loaded after it on a database built from schema.rb.
unless Rails.env.test?
  ids = Listing.where.missing(:units).pluck(:id)
  ListingUnit.insert_all(ids.map { |listing_id| { listing_id:, position: 1 } }) if ids.any?

  # Every accommodation listing has a stay rate (RAA-104), zero until its partner sets one.
  require Rails.root.join("db/migrate/20261014000001_create_stay_rates").to_s
  CreateStayRates.backfill(ActiveRecord::Base.connection)

  # Every tour has tour details (RAA-110): the sample tours become daily joiner tours, with no
  # price until their partners set one, and the tour category gets its RAA-110 attrs schema.
  require Rails.root.join("db/migrate/20261014150000_create_tour_details").to_s
  CreateTourDetails.backfill(ActiveRecord::Base.connection)
end

# The data migrations above insert areas without a status, which a database built from
# schema.rb makes draft (RAA-59); a migrated one published them when the column was added.
# They are the sample destinations, so they are live either way.
unless Rails.env.test?
  require Rails.root.join("db/migrate/20261006000001_seed_discovery_sample_data").to_s
  Area.where(slug: SeedDiscoverySampleData::AREAS.map(&:first) + [ "santa-fe" ]).update_all(status: "published")

  # The search box reads the search_terms view (RAA-60); fill it from what was just loaded.
  SearchTerm.refresh
end
