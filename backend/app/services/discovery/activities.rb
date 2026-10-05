module Discovery
  # "Browse by activity": activity tags with how many bookable areas and published landmarks
  # have them, most areas first. An activity with nowhere to book is left out.
  class Activities < ApplicationService
    def call
      Tag.activity
        .joins(:landmarks).merge(Landmark.published)
        .where(landmarks: { area_id: Area.bookable.select(:id) })
        .group("tags.id")
        .select("tags.slug, tags.name",
          "COUNT(DISTINCT landmarks.area_id) AS area_count", "COUNT(DISTINCT landmarks.id) AS landmark_count")
        .order(Arel.sql("area_count DESC, landmark_count DESC"), "tags.name")
        .map { |tag| { slug: tag.slug, name: tag.name, area_count: tag.area_count, landmark_count: tag.landmark_count } }
    end
  end
end
