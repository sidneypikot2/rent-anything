# A listing as its own partner sees it (the `partner_listing` schema in
# spec/swagger_helper.rb). The exact location is fine here: the reader owns the listing.
# A tour's landmarks come by name, and `covers` is the destinations they're in (RAA-70).
# Preload visited_landmarks: :area (Listing.for_partner) and pass destinations for a list.
module PartnerListingSerializer
  def self.call(listing, destinations: PartnerLandmarkSerializer.destinations_for(listing.visited_landmarks))
    category = listing.category
    landmarks = listing.visited_landmarks.sort_by(&:name).map { |landmark| PartnerLandmarkSerializer.call(landmark, destinations) }
    {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      status: listing.status,
      category: { id: category.id, slug: category.slug, name: category.name, booking_type: category.booking_type },
      area: { slug: listing.area.slug, name: listing.area.name },
      address: listing.slice(:street, :city, :region, :province, :postal_code, :country).symbolize_keys,
      location: { lat: listing.location.y, lng: listing.location.x },
      attrs: listing.attrs,
      cancellation_policy: listing.cancellation_policy,
      landmarks:,
      covers: landmarks.filter_map { |landmark| landmark[:destination] }.uniq.sort_by { |place| place[:name] },
      created_at: listing.created_at,
      updated_at: listing.updated_at
    }
  end
end
