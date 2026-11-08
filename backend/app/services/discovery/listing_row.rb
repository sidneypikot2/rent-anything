module Discovery
  # One listing as a guest's browse pages list it: an area page's What to book and a business's
  # page (the `area_listing` schema). A summary plus its booking type, its business, its first
  # photos, what its details say it includes, its cancellation policy and the places to see it
  # goes to; never its location.
  module ListingRow
    # A row's carousel shows a few photos; the listing page has them all.
    PHOTOS = 6
    ASSOCIATIONS = [ { category: :parent }, :area, :business, :units, :stay_rate, :vehicle_rate, :flat_rate, :tour_detail, *Listing::ACTIVITY_ASSOCIATIONS, :cover_photo, :ready_photos, :visited_landmarks, :landmark_visits, :tour_inclusions ].freeze

    def self.call(listing)
      ListingSummarySerializer.call(listing).merge(
        area_name: listing.area.name,
        booking_type: listing.category.booking_type,
        summary: ListingDetailSerializer.summary(listing),
        **ListingDetailSerializer.offered_by(listing),
        price_from_cents: PricingSerializer.price_from_cents(listing),
        price_unit: PricingSerializer.price_unit(listing),
        photos: listing.ready_photos.first(PHOTOS).map { |photo| ListingPhotoSerializer.call(photo) },
        details: ListingDetailSerializer.details(listing),
        tour: tour_json(listing),
        cancellation_policy: listing.cancellation_policy,
        handover: handover_json(listing),
        goes_to: goes_to_json(listing)
      )
    end

    # The published places to see it stops at, in the order it makes them (RAA-281).
    def self.goes_to_json(listing)
      order = listing.landmark_visits.map(&:landmark_id)
      listing.visited_landmarks.select(&:published?).sort_by { |landmark| order.index(landmark.id) || order.size }
        .map { |landmark| landmark.slice(:slug, :name).symbolize_keys }
    end

    # A tour's kind and the group it takes, for its row's chips, and for its shop page (RAA-281)
    # when it starts, where it leaves from (the listing's street and town: its jump-off point,
    # which a tour shows openly), what it includes and what it leaves out; nil for anything else.
    def self.tour_json(listing)
      detail = listing.tour_detail
      return nil unless detail

      {
        **detail.slice(:tour_type, :min_guests, :max_guests, :start_times, :not_included).symbolize_keys,
        inclusions: listing.tour_inclusions.map(&:kind),
        jump_off: { street: listing.street.presence, city: listing.city.presence }
      }
    end

    # A vehicle's delivery and pick-up fees (RAA-204), for its card, priced or not, and its child
    # helmets' (RAA-205), for What to book's filters: all nil when it has no rate yet; nil for
    # anything else.
    def self.handover_json(listing)
      return unless listing.category.timed_rental?

      rate = listing.vehicle_rate
      { delivery_fee_cents: rate&.delivery_fee_cents, return_pickup_fee_cents: rate&.return_pickup_fee_cents,
        child_helmet_fee_cents: rate&.child_helmet_fee_cents, deposit_cents: rate&.security_deposit_cents }
    end
  end
end
