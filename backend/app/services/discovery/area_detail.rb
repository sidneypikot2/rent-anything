module Discovery
  # One destination: the areas under it that have something to book (Cebu lists Cebu City),
  # its published landmarks with their tags, and the active listings in it, each with a
  # one-line summary, its business, how many units it has (RAA-86, RAA-100) and its nightly
  # price once it has one (RAA-104).
  class AreaDetail < ApplicationService
    def initialize(area)
      @area = area
    end

    def call
      {
        area: AreaSerializer.call(@area),
        areas: @area.children.browsable.includes(:parent).order(:name).map { |area| AreaSerializer.call(area) },
        landmarks: @area.landmarks.published.includes(:tags).order(:name).map { |landmark| landmark_json(landmark) },
        listings: @area.listings.active.includes(:category, :area, :business, :units, :stay_rate).order(:title).map do |listing|
          ListingSummarySerializer.call(listing).merge(
            booking_type: listing.category.booking_type,
            summary: ListingDetailSerializer.summary(listing),
            **ListingDetailSerializer.offered_by(listing),
            price_from_cents: PricingSerializer.price_from_cents(listing)
          )
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
