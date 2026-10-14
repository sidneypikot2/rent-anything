# A tour's details (RAA-110) for its partner (the `partner_tour` schema in
# spec/swagger_helper.rb) and for guests (`guest_tour`), and any listing's blocked dates.
# Dates and blocks already past are left out. Preload tour_detail, tour_dates, tour_inclusions
# and availability_blocks.
module TourSerializer
  DETAIL_FIELDS = %w[tour_type min_guests max_guests duration_value duration_unit weekdays base_price_cents].freeze

  def self.partner(listing)
    detail = listing.tour_detail
    return nil unless detail

    {
      **detail.slice(*DETAIL_FIELDS, "max_groups_per_day").symbolize_keys,
      price_unit: detail.price_unit,
      dates: listing.tour_dates.map(&:date).select { |date| date >= Date.current }.map(&:iso8601),
      inclusions: inclusions(listing)
    }
  end

  # What a guest needs to choose a day: the days it runs over the next weeks, not the rules.
  def self.guest(listing)
    detail = listing.tour_detail
    return nil unless detail

    {
      **detail.slice(*DETAIL_FIELDS).symbolize_keys,
      price_unit: detail.price_unit,
      open_dates: Tours::Schedule.new(listing).open_dates.map(&:iso8601),
      inclusions: inclusions(listing)
    }
  end

  def self.inclusions(listing)
    listing.tour_inclusions.map do |inclusion|
      { kind: inclusion.kind, options: inclusion.options, note: inclusion.note,
        price_per_head_cents: inclusion.price_per_head_cents }
    end
  end

  def self.blocked_dates(listing)
    listing.availability_blocks.select { |block| block.ends_on >= Date.current }.map do |block|
      { starts_on: block.starts_on.iso8601, ends_on: block.ends_on.iso8601, reason: block.reason }
    end
  end
end
