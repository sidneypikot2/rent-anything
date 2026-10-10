module Discovery
  # "Browse by activity": activity tags with how many bookable areas and published landmarks
  # have them, and how many active listings in bookable areas there are to book for them — a
  # listing's tags come from its category (CategoryTag). Most to book first. An activity with
  # no published landmark in a bookable area is left out.
  class Activities < ApplicationService
    LISTING_COUNT = <<~SQL.squish.freeze
      (SELECT COUNT(*) FROM listings
        JOIN category_tags ON category_tags.category_id = listings.category_id
        WHERE category_tags.tag_id = tags.id AND listings.status = 'active'
          AND listings.area_id IN (%s)) AS listing_count
    SQL

    def call
      bookable = Area.bookable.select(:id)
      Tag.activity
        .joins(:landmarks).merge(Landmark.published)
        .where(landmarks: { area_id: bookable })
        .group("tags.id")
        .select("tags.slug, tags.name",
          "COUNT(DISTINCT landmarks.area_id) AS area_count", "COUNT(DISTINCT landmarks.id) AS landmark_count",
          format(LISTING_COUNT, bookable.to_sql))
        .order(Arel.sql("listing_count DESC, area_count DESC, landmark_count DESC"), "tags.name")
        .map do |tag|
          { slug: tag.slug, name: tag.name, area_count: tag.area_count, landmark_count: tag.landmark_count,
            listing_count: tag.listing_count }
        end
    end
  end
end
