module Discovery
  # One destination: the areas under it that have something to book (Cebu lists Cebu City),
  # its published landmarks with their tags, and the active listings in it.
  class AreaDetail < ApplicationService
    def initialize(area)
      @area = area
    end

    def call
      {
        area: AreaSerializer.call(@area),
        areas: @area.children.browsable.includes(:parent).order(:name).map { |area| AreaSerializer.call(area) },
        landmarks: @area.landmarks.published.includes(:tags).order(:name).map { |landmark| landmark_json(landmark) },
        listings: @area.listings.active.includes(:category, :area).order(:title).map do |listing|
          ListingSummarySerializer.call(listing).merge(booking_type: listing.category.booking_type)
        end
      }
    end

    private

    def landmark_json(landmark)
      {
        slug: landmark.slug,
        name: landmark.name,
        description: landmark.description,
        tags: landmark.tags.sort_by(&:name).map { |tag| TagSerializer.call(tag) }
      }
    end
  end
end
