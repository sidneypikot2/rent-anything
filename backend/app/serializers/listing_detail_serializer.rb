# One active listing as a traveller sees it (the `listing_detail` schema in
# spec/swagger_helper.rb, RAA-86). Never the location or address: the exact point is
# revealed only after a paid booking. The business offering it and how many units it has
# (RAA-100): "by Basilia Guest House · 5 rooms". An area page's rows reuse its summary and
# offered_by. Its pricing (RAA-104): a stay's nightly rate once it has a price, the guests it
# sleeps, and its fees. Its ready photos in the partner's order (RAA-106). A tour's details and
# the days it runs (RAA-110). Preload business, category, units, stay_rate, fees,
# ready_photos, tour_detail, tour_dates, tour_inclusions and availability_blocks.
module ListingDetailSerializer
  SUMMARY_LENGTH = 160

  def self.call(listing)
    category = listing.category
    {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      summary: summary(listing),
      category: { slug: category.slug, name: category.name },
      booking_type: category.booking_type,
      area: { slug: listing.area.slug, name: listing.area.name },
      **offered_by(listing),
      price_from_cents: PricingSerializer.price_from_cents(listing),
      price_unit: PricingSerializer.price_unit(listing),
      guests: listing.stay_rate && listing.attrs["guests"],
      stay_rate: listing.stay_rate&.priced? ? PricingSerializer.stay_rate(listing.stay_rate) : nil,
      fees: PricingSerializer.fees(listing),
      tour: TourSerializer.guest(listing),
      photos: listing.ready_photos.first(listing.photo_limit).map { |photo| ListingPhotoSerializer.call(photo) }
    }
  end

  # The description's first non-blank line, cut to SUMMARY_LENGTH characters.
  def self.summary(listing)
    line = listing.description.lines.map(&:strip).find(&:present?)
    line.to_s.truncate(SUMMARY_LENGTH, omission: "…")
  end

  # partner_name repeats the business name until the web app reads business (RAA-101).
  def self.offered_by(listing)
    units_count = listing.units.size
    {
      business: { name: listing.business.name },
      units_count:,
      units_label: listing.category.units_label(units_count),
      partner_name: listing.business.name
    }
  end
end
