module Discovery
  # One destination: the areas under it that have something to book (Cebu lists Cebu City),
  # its published landmarks with their tags, and the active listings in it, each with a
  # one-line summary, its business, how many units it has (RAA-86, RAA-100) and its nightly
  # price once it has one (RAA-104), or a tour's base price per group or person (RAA-110). Each
  # row also carries its first photos, what its details say it includes and its cancellation
  # policy (RAA-124), for the row's carousel and chips.
  class AreaDetail < ApplicationService
    # A row's carousel shows a few photos; the listing page has them all.
    ROW_PHOTOS = 6

    def initialize(area)
      @area = area
    end

    def call
      {
        area: AreaSerializer.call(@area),
        areas: @area.children.browsable.includes(:parent).order(:name).map { |area| AreaSerializer.call(area) },
        landmarks: @area.landmarks.published.includes(:tags).order(:name).map { |landmark| landmark_json(landmark) },
        listings: @area.listings.active
          .includes(:category, :area, :business, :units, :stay_rate, :vehicle_rate, :tour_detail, :cover_photo, :ready_photos)
          .order(:title).map do |listing|
          ListingSummarySerializer.call(listing).merge(
            booking_type: listing.category.booking_type,
            summary: ListingDetailSerializer.summary(listing),
            **ListingDetailSerializer.offered_by(listing),
            price_from_cents: PricingSerializer.price_from_cents(listing),
            price_unit: PricingSerializer.price_unit(listing),
            photos: listing.ready_photos.first(ROW_PHOTOS).map { |photo| ListingPhotoSerializer.call(photo) },
            details: ListingDetailSerializer.details(listing),
            cancellation_policy: listing.cancellation_policy
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
