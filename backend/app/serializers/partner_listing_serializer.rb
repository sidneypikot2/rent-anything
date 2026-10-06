# A listing as its own partner sees it (the `partner_listing` schema in
# spec/swagger_helper.rb). The exact location is fine here: the reader owns the listing.
module PartnerListingSerializer
  def self.call(listing)
    category = listing.category
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
      created_at: listing.created_at,
      updated_at: listing.updated_at
    }
  end
end
