# A water activity's details and current offers (RAA-270) for its partner (the
# `partner_activity` schema in spec/swagger_helper.rb). Preload Listing::ACTIVITY_ASSOCIATIONS.
module ActivitySerializer
  DETAIL_FIELDS = %w[sold_by schedule opens_at closes_at departure_times seats_per_unit min_age included requirements].freeze

  def self.partner(listing)
    detail = listing.activity_detail
    return nil unless detail

    {
      **detail.slice(*DETAIL_FIELDS).symbolize_keys,
      offers: listing.offers.map { |offer| offer.slice(:id, :name, :duration_minutes, :price_cents).symbolize_keys }
    }
  end
end
