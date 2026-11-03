module Discovery
  # One listing as a guest's browse pages list it: an area page's What to book and a business's
  # page (the `area_listing` schema). A summary plus its booking type, its business, its first
  # photos, what its details say it includes and its cancellation policy; never its location.
  module ListingRow
    # A row's carousel shows a few photos; the listing page has them all.
    PHOTOS = 6
    ASSOCIATIONS = [ { category: :parent }, :area, :business, :units, :stay_rate, :vehicle_rate, :flat_rate, :tour_detail, :cover_photo, :ready_photos ].freeze

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
        tour: tour_json(listing.tour_detail),
        cancellation_policy: listing.cancellation_policy,
        handover: handover_json(listing)
      )
    end

    # A tour's kind and the group it takes, for its row's chips; nil for anything else.
    def self.tour_json(detail)
      detail&.slice(:tour_type, :min_guests, :max_guests)&.symbolize_keys
    end

    # A vehicle's delivery and pick-up fees (RAA-204), for its card, priced or not, and its child
    # helmets' (RAA-205), for What to book's filters: all nil when it has no rate yet; nil for
    # anything else.
    def self.handover_json(listing)
      return unless listing.category.vehicle?

      rate = listing.vehicle_rate
      { delivery_fee_cents: rate&.delivery_fee_cents, return_pickup_fee_cents: rate&.return_pickup_fee_cents,
        child_helmet_fee_cents: rate&.child_helmet_fee_cents }
    end
  end
end
