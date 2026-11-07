# A water activity's details and current offers (RAA-270), with its inclusions, add-ons and
# drop-off zones (RAA-271), for its partner (the `partner_activity` schema in
# spec/swagger_helper.rb). Preload Listing::ACTIVITY_ASSOCIATIONS.
module ActivitySerializer
  DETAIL_FIELDS = %w[
    sold_by schedule opens_at closes_at departure_times seats_per_unit min_age included requirements inclusions
  ].freeze

  def self.partner(listing)
    detail = listing.activity_detail
    return nil unless detail

    {
      **detail.slice(*DETAIL_FIELDS).symbolize_keys,
      offers: listing.offers.map do |offer|
        offer.slice(:id, :name, :duration_minutes, :price_cents, :max_guests).symbolize_keys
      end,
      add_ons: listing.add_ons.map { |add_on| add_on.slice(:id, :kind, :price_cents, :charged_per).symbolize_keys },
      delivery_zones: detail.zones.map { |zone| zone.slice(:max_distance_m, :fee_cents).symbolize_keys }
    }
  end
end
