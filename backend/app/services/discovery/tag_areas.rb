module Discovery
  # "I want to snorkel": for each tag, the bookable areas with published landmarks carrying
  # it, most matching landmarks first, then most active listings. One query for all tags;
  # returns tag id => areas.
  class TagAreas < ApplicationService
    def initialize(tag_ids)
      @tag_ids = tag_ids
    end

    def call
      Area.bookable
        .joins(landmarks: :landmark_tags)
        .merge(Landmark.published)
        .where(landmark_tags: { tag_id: @tag_ids })
        .group("areas.id", "landmark_tags.tag_id")
        .select("areas.slug, areas.name, landmark_tags.tag_id AS tag_id",
          "COUNT(DISTINCT landmarks.id) AS landmark_count")
        .order(Arel.sql("landmark_count DESC"), Arel.sql(listing_count_sql), :name)
        .group_by(&:tag_id)
        .transform_values do |areas|
          areas.map { |area| { slug: area.slug, name: area.name, landmark_count: area.landmark_count } }
        end
    end

    private

    def listing_count_sql
      "(SELECT COUNT(*) FROM listings WHERE listings.area_id = areas.id AND listings.status = 'active') DESC"
    end
  end
end
