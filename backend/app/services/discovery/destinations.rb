module Discovery
  # The destinations a guest can pick from: areas with at least one active listing, most
  # listings first, each with its top activities by how many published landmarks carry them.
  # to_book_count is what the area's own page counts to book (AreaDetail's listings, as What to
  # book shows them): one per business per guest group, the published areas inside it included.
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
      to_book = to_book_counts(areas)

      areas.map do |area|
        AreaSerializer.call(area).merge(
          landmark_count: area.landmark_count,
          listing_count: area.listing_count,
          to_book_count: to_book.fetch(area.id),
          activities: activities.fetch(area.id, []).first(ACTIVITY_LIMIT).map { |tag| TagSerializer.call(tag) }
        )
      end
    end

    private

    # area id => its distinct [business, guest group] pairs among the active listings in it and in
    # the published areas under it, at any depth (Area.subtree_of, walked here in one pass).
    def to_book_counts(areas)
      children = Area.published.where.not(parent_id: nil).pluck(:parent_id, :id)
        .group_by(&:first).transform_values { |pairs| pairs.map(&:last) }
      cards = Listing.active.where(area_id: Area.published.select(:id)).includes(category: :parent)
        .group_by(&:area_id)
        .transform_values { |listings| listings.map { |listing| [ listing.business_id, listing.category.guest_group ] } }
      subtree = lambda do |id, seen = Set.new|
        return [] unless seen.add?(id)
        [ id, *children.fetch(id, []).flat_map { |child| subtree.call(child, seen) } ]
      end
      areas.to_h { |area| [ area.id, subtree.call(area.id).flat_map { |id| cards.fetch(id, []) }.uniq.size ] }
    end

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
