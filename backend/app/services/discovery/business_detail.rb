module Discovery
  # One business as a guest sees it (GET /businesses/:id): its name, what it says about itself,
  # its town, and its active listings in published places, as an area page lists them
  # (ListingRow). `area` is the place most of them are in, for the page's way back and its trip.
  # A business with nothing to book has no page.
  class BusinessDetail < ApplicationService
    def initialize(business)
      @business = business
    end

    def call
      listings = @business.listings.active.where(area_id: Area.published.select(:id))
        .includes(*ListingRow::ASSOCIATIONS).order(:title, :id).to_a
      raise ActiveRecord::RecordNotFound, "This business has nothing to book" if listings.empty?

      area = listings.map(&:area).tally.max_by { |each, count| [ count, -each.id ] }.first
      {
        business: {
          id: @business.id,
          name: @business.name,
          description: @business.description,
          city: @business.city.presence,
          province: @business.province.presence
        },
        area: AreaSerializer.call(area),
        listings: listings.map { |listing| ListingRow.call(listing) }
      }
    end
  end
end
