module Discovery
  # "I want to snorkel": the bookable areas with published landmarks carrying the tag, most
  # matching landmarks first, then most active listings.
  class TagAreas < ApplicationService
    def initialize(tag)
      @tag = tag
    end

    def call
      Area.bookable
        .joins(landmarks: :landmark_tags)
        .merge(Landmark.published)
        .where(landmark_tags: { tag_id: @tag.id })
        .group(:id)
        .select("areas.slug, areas.name, COUNT(DISTINCT landmarks.id) AS landmark_count")
        .order(Arel.sql("landmark_count DESC"), Arel.sql(listing_count_sql), :name)
        .map { |area| { slug: area.slug, name: area.name, landmark_count: area.landmark_count } }
    end

    private

    def listing_count_sql
      "(SELECT COUNT(*) FROM listings WHERE listings.area_id = areas.id AND listings.status = 'active') DESC"
    end
  end
end
