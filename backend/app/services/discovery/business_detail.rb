module Discovery
  # One business as a guest sees it (GET /businesses/:id): its name, what it says about itself,
  # its town, and its active listings in published places, as an area page lists them
  # (ListingRow). `area` is the place most of them are in, for the page's way back and its trip.
  # A business with nothing to book has no page. Its shop page (RAA-281) also gets what the
  # partner tells guests (BusinessShopSerializer), its logo and cover photos, and whether its
  # partner passed the ID check.
  class BusinessDetail < ApplicationService
    def initialize(business)
      @business = business
    end

    def call
      listings = @business.listings.active.where(area_id: Area.published.select(:id))
        .includes(*ListingRow::ASSOCIATIONS).order(:title, :id).to_a
      raise ActiveRecord::RecordNotFound, "This business has nothing to book" if listings.empty?

      area = listings.map(&:area).tally.max_by { |each, count| [ count, -each.id ] }.first
      # A shop's door is public; a business that only offers stays may be someone's home, so
      # its street and pin wait for a booking, as a listing's exact point does (RAA-281).
      public_address = listings.any? { |listing| listing.category.booking_type != "stay" }
      {
        business: {
          id: @business.id,
          name: @business.name,
          description: @business.description,
          city: @business.city.presence,
          province: @business.province.presence,
          street: public_address ? @business.street.presence : nil,
          location: public_address && @business.location ? { lat: @business.location.y, lng: @business.location.x } : nil,
          verified: @business.partner.id_verified?,
          **BusinessShopSerializer.call(@business),
          **BusinessShopSerializer.photos(@business)
        },
        area: AreaSerializer.call(area),
        listings: listings.map { |listing| ListingRow.call(listing) }
      }
    end
  end
end
