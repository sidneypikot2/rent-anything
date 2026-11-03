module Discovery
  # One destination: the areas under it that have something to book (Cebu lists Cebu City),
  # its photos (RAA-210), its published landmarks with their tags and photos, and the active listings in it, each with a
  # one-line summary, its business, how many units it has (RAA-86, RAA-100) and its nightly
  # price once it has one (RAA-104), or a tour's base price per group or person (RAA-110). Each
  # row also carries its first photos, what its details say it includes and its cancellation
  # policy (RAA-124), for the row's carousel and chips. The listings include those of the
  # published places inside it, however deep, each naming its own place, so an island's page
  # shows everything to book on it; a place to see names the active listings that visit it.
  # pets: true keeps, of the stays, those that allow pets (RAA-185). listings: false leaves the
  # listings out (the plan pages page through them with Discovery::PlanListings).
  class AreaDetail < ApplicationService
    def initialize(area, pets: false, listings: true)
      @area = area
      @pets = pets
      @with_listings = listings
    end

    def call
      {
        area: AreaSerializer.call(@area),
        # Its banner's carousel, the first photo first (RAA-210).
        photos: @area.ready_photos.map { |photo| ListingPhotoSerializer.call(photo) },
        areas: @area.children.browsable.includes(:parent).order(:name).map { |area| AreaSerializer.call(area) },
        landmarks: landmarks.map { |landmark| landmark_json(landmark) },
        listings: @with_listings ? listings.includes(*ListingRow::ASSOCIATIONS).order(:title).map { |listing| ListingRow.call(listing) } : []
      }
    end

    private

    # With pets (RAA-185), only the stays that allow them.
    def listings
      listings = Listing.active.in_area_tree(@area)
      @pets ? listings.pet_friendly : listings
    end

    def landmarks
      @landmarks ||= @area.landmarks.published.includes(:tags, :ready_photos).order(:name).to_a
    end

    # landmark id => the ids of the active listings that visit it.
    def visitors
      @visitors ||= ListingLandmark.visits.joins(:listing).merge(Listing.active)
        .where(landmark_id: landmarks.map(&:id)).order(:listing_id)
        .pluck(:landmark_id, :listing_id)
        .group_by(&:first).transform_values { |pairs| pairs.map(&:last) }
    end

    def landmark_json(landmark)
      {
        slug: landmark.slug,
        name: landmark.name,
        description: landmark.description,
        tags: landmark.tags.sort_by(&:name).map { |tag| TagSerializer.call(tag) },
        photos: landmark.ready_photos.map { |photo| ListingPhotoSerializer.call(photo) },
        visited_by: visitors.fetch(landmark.id, [])
      }
    end
  end
end
