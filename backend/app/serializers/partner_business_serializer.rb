# A business as the partner who runs it sees it (the `partner_business` schema in
# spec/swagger_helper.rb, RAA-100). Load it with a `listings_count` column.
module PartnerBusinessSerializer
  def self.call(business)
    {
      id: business.id,
      name: business.name,
      description: business.description,
      address: {
        street: business.street,
        city: business.city,
        region: business.region,
        province: business.province,
        postal_code: business.postal_code,
        country: business.country
      },
      location: business.location && { lat: business.location.y, lng: business.location.x },
      listings_count: business.listings_count,
      created_at: business.created_at,
      updated_at: business.updated_at
    }
  end
end
