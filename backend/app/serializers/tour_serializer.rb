# A tour's details (RAA-110) for its partner (the `partner_tour` schema in
# spec/swagger_helper.rb) and for guests (`guest_tour`). A tour runs every day (RAA-117).
# Preload tour_detail and tour_inclusions.
module TourSerializer
  DETAIL_FIELDS = %w[tour_type min_guests max_guests duration_value duration_unit base_price_cents].freeze

  def self.partner(listing)
    detail = listing.tour_detail
    return nil unless detail

    {
      **detail.slice(*DETAIL_FIELDS, "max_groups_per_day").symbolize_keys,
      price_unit: detail.price_unit,
      inclusions: inclusions(listing)
    }
  end

  # Nothing until the tour has a price, as with a stay's rate.
  def self.guest(listing)
    detail = listing.tour_detail
    return nil unless detail&.priced?

    {
      **detail.slice(*DETAIL_FIELDS).symbolize_keys,
      price_unit: detail.price_unit,
      inclusions: inclusions(listing)
    }
  end

  def self.inclusions(listing)
    listing.tour_inclusions.map do |inclusion|
      { kind: inclusion.kind, options: inclusion.options, note: inclusion.note,
        price_per_head_cents: inclusion.price_per_head_cents }
    end
  end
end
