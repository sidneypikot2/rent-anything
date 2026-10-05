module Discovery
  # The destinations a guest can pick from: areas with at least one active listing, most
  # listings first, each with its top activities by how many published landmarks carry them.
  class Destinations < ApplicationService
    ACTIVITY_LIMIT = 3

    def call
      areas = Area.bookable.includes(:parent)
        .select("areas.*",
          "(SELECT COUNT(*) FROM listings WHERE listings.area_id = areas.id AND listings.status = 'active') AS listing_count",
          "(SELECT COUNT(*) FROM landmarks WHERE landmarks.area_id = areas.id AND landmarks.status = 'published') " \
            "AS landmark_count")
        .order(Arel.sql("listing_count DESC"), :name)
        .to_a
      activities = top_activities(areas.map(&:id))

      areas.map do |area|
        AreaSerializer.call(area).merge(
          landmark_count: area.landmark_count,
          listing_count: area.listing_count,
          activities: activities.fetch(area.id, []).first(ACTIVITY_LIMIT).map { |tag| TagSerializer.call(tag) }
        )
      end
    end

    private

    # area id => activity tags, most landmarks first.
    def top_activities(area_ids)
      Tag.activity
        .joins(:landmarks).merge(Landmark.published)
        .where(landmarks: { area_id: area_ids })
        .group("tags.id", "landmarks.area_id")
        .select("tags.*", "landmarks.area_id AS area_id", "COUNT(*) AS landmark_count")
        .order(Arel.sql("landmark_count DESC"), "tags.name")
        .group_by(&:area_id)
    end
  end
end
