module Discovery
  # One destination: the areas under it that have something to book (Cebu lists Cebu City),
  # its photos (RAA-210), its published landmarks with their tags and photos, and the active listings in it, each with a
  # one-line summary, its business, how many units it has (RAA-86, RAA-100) and its nightly
  # price once it has one (RAA-104), or a tour's base price per group or person (RAA-110). Each
  # row also carries its first photos, what its details say it includes and its cancellation
  # policy (RAA-124), for the row's carousel and chips. The listings include those of the
  # published places inside it, however deep, each naming its own place, so an island's page
  # shows everything to book on it. Its places to see likewise include those of the published
  # places inside it (RAA-285): a place pinned in Santa Fe is on Bantayan Island's page too.
  # A place to see names the active listings that visit it.
  # pets: true keeps, of the stays, those that allow pets (RAA-185). listings: false leaves the
  # listings out (the plan pages page through them with Discovery::PlanListings).
  # Its page also gets to know the place (RAA-252): the guide the team wrote (blank fields as
  # nulls), where each place to see is, and for each place inside it, where it is, how many
  # stays it has and what it counts to book, the places under it included.
  class AreaDetail < ApplicationService
    GUIDE = %i[tagline description getting_there best_time_to_visit].freeze

    def initialize(area, pets: false, listings: true)
      @area = area
      @pets = pets
      @with_listings = listings
    end

    def call
      {
        area: AreaSerializer.call(@area),
        guide: GUIDE.index_with { |field| @area.public_send(field).presence },
        port: @area.port,
        # Its banner's carousel, the first photo first (RAA-210).
        photos: @area.ready_photos.map { |photo| ListingPhotoSerializer.call(photo) },
        areas: @area.children.browsable.includes(:parent).order(:name).map { |area| place_json(area) },
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
      @landmarks ||= Landmark.published.in_area_tree(@area).includes(:tags, :ready_photos).order(:name).to_a
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
        location: lat_lng(landmark.location),
        must_see: landmark.must_see,
        boat_departure: landmark.boat_departure && lat_lng(landmark.boat_departure),
        visited_by: visitors.fetch(landmark.id, [])
      }
    end

    def place_json(area)
      counts = place_counts.fetch(area.id, {})
      AreaSerializer.call(area).merge(
        center: lat_lng(area.center),
        stay_count: counts.fetch(:stays, 0),
        to_book_count: counts.fetch(:to_book, 0)
      )
    end

    # child id => { stays: its active stays, to_book: its distinct [business, guest group]
    # pairs, as Destinations counts them }, over the published places under it, however deep.
    def place_counts
      @place_counts ||= begin
        parents = Area.published.subtree_of(@area).pluck(:id, :parent_id).to_h
        child_of = lambda do |id|
          id = parents[id] while parents[id] && parents[id] != @area.id
          id
        end
        Listing.active.in_area_tree(@area).where.not(area_id: @area.id).includes(category: :parent)
          .group_by { |listing| child_of.call(listing.area_id) }
          .transform_values do |listings|
            { stays: listings.count { |listing| listing.category.guest_group == "stay" },
              to_book: listings.map { |listing| [ listing.business_id, listing.category.guest_group ] }.uniq.size }
          end
      end
    end

    def lat_lng(point)
      { lat: point.y.round(5), lng: point.x.round(5) }
    end
  end
end
