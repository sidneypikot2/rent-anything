module Discovery
  # One destination: the areas under it that have something to book (Cebu lists Cebu City),
  # its published landmarks with their tags, and the active listings in it, each with a
  # one-line summary, its business, how many units it has (RAA-86, RAA-100) and its nightly
  # price once it has one (RAA-104), or a tour's base price per group or person (RAA-110). Each
  # row also carries its first photos, what its details say it includes and its cancellation
  # policy (RAA-124), for the row's carousel and chips. The listings include those of the
  # published places inside it, however deep, each naming its own place, so an island's page
  # shows everything to book on it; a place to see names the active listings that visit it.
  # pets: true keeps, of the stays, those that allow pets (RAA-185).
  class AreaDetail < ApplicationService
    # A row's carousel shows a few photos; the listing page has them all.
    ROW_PHOTOS = 6

    def initialize(area, pets: false)
      @area = area
      @pets = pets
    end

    def call
      {
        area: AreaSerializer.call(@area),
        areas: @area.children.browsable.includes(:parent).order(:name).map { |area| AreaSerializer.call(area) },
        landmarks: landmarks.map { |landmark| landmark_json(landmark) },
        listings: listings.includes({ category: :parent }, :area, :business, :units, :stay_rate, :vehicle_rate, :tour_detail, :cover_photo, :ready_photos)
          .order(:title).map do |listing|
          ListingSummarySerializer.call(listing).merge(
            area_name: listing.area.name,
            booking_type: listing.category.booking_type,
            summary: ListingDetailSerializer.summary(listing),
            **ListingDetailSerializer.offered_by(listing),
            price_from_cents: PricingSerializer.price_from_cents(listing),
            price_unit: PricingSerializer.price_unit(listing),
            photos: listing.ready_photos.first(ROW_PHOTOS).map { |photo| ListingPhotoSerializer.call(photo) },
            details: ListingDetailSerializer.details(listing),
            tour: tour_json(listing.tour_detail),
            cancellation_policy: listing.cancellation_policy
          )
        end
      }
    end

    private

    # With pets (RAA-185), only the stays that allow them.
    def listings
      listings = Listing.active.where(area_id: Area.published.subtree_of(@area).select(:id))
      @pets ? listings.pet_friendly : listings
    end

    def landmarks
      @landmarks ||= @area.landmarks.published.includes(:tags).order(:name).to_a
    end

    # landmark id => the ids of the active listings that visit it.
    def visitors
      @visitors ||= ListingLandmark.visits.joins(:listing).merge(Listing.active)
        .where(landmark_id: landmarks.map(&:id)).order(:listing_id)
        .pluck(:landmark_id, :listing_id)
        .group_by(&:first).transform_values { |pairs| pairs.map(&:last) }
    end

    # A tour's kind and the group it takes, for its row's chips; nil for anything else.
    def tour_json(detail)
      detail&.slice(:tour_type, :min_guests, :max_guests)&.symbolize_keys
    end

    def landmark_json(landmark)
      {
        slug: landmark.slug,
        name: landmark.name,
        description: landmark.description,
        tags: landmark.tags.sort_by(&:name).map { |tag| TagSerializer.call(tag) },
        visited_by: visitors.fetch(landmark.id, [])
      }
    end
  end
end
