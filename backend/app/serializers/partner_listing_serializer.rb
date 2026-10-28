# A listing as its own partner sees it (the `partner_listing` schema in
# spec/swagger_helper.rb). The exact location is fine here: the reader owns the listing.
# A tour's landmarks come by name, and `covers` is the destinations they're in (RAA-70).
# Its photos, still uploading ones too, come with the ids a change sends back (RAA-106).
# A tour's details (RAA-110), and how many photos it takes. Its live_blockers (RAA-115) say
# what it lacks to go live. Preload ASSOCIATIONS, and pass destinations for a list.
module PartnerListingSerializer
  ASSOCIATIONS = [ :business, :category, :area, :units, :stay_rate, :vehicle_rate, :flat_rate, :fees, :photos, *Listing::TOUR_ASSOCIATIONS,
    { visited_landmarks: :area } ].freeze

  def self.call(listing, destinations: PartnerLandmarkSerializer.destinations_for(listing.visited_landmarks))
    category = listing.category
    landmarks = listing.visited_landmarks.sort_by(&:name).map { |landmark| PartnerLandmarkSerializer.call(landmark, destinations) }
    {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      status: listing.status,
      live_blockers: listing.live_blockers,
      category: { id: category.id, slug: category.slug, name: category.name, booking_type: category.booking_type },
      area: { slug: listing.area.slug, name: listing.area.name },
      address: listing.slice(:street, :city, :region, :province, :postal_code, :country).symbolize_keys,
      location: { lat: listing.location.y, lng: listing.location.x },
      attrs: listing.attrs,
      cancellation_policy: listing.cancellation_policy,
      booking_mode: listing.booking_mode,
      units_count: listing.units.size,
      stay_rate: PricingSerializer.stay_rate(listing.stay_rate),
      vehicle_rate: PricingSerializer.vehicle_rate(listing.vehicle_rate),
      flat_rate: PricingSerializer.flat_rate(listing.flat_rate),
      fees: PricingSerializer.fees(listing),
      tour: TourSerializer.partner(listing),
      business: { id: listing.business.id, name: listing.business.name },
      landmarks:,
      covers: landmarks.filter_map { |landmark| landmark[:destination] }.uniq.sort_by { |place| place[:name] },
      photos: listing.photos.map { |photo| ListingPhotoSerializer.partner(photo) },
      photo_limit: listing.photo_limit,
      created_at: listing.created_at,
      updated_at: listing.updated_at
    }
  end
end
