# One active listing as a traveller sees it (the `listing_detail` schema in
# spec/swagger_helper.rb, RAA-86). Never the location or address: the exact point is
# revealed only after a paid booking. The business offering it and how many units it has
# (RAA-100): "by Basilia Guest House · 5 rooms". An area page's rows reuse its summary and
# offered_by. Its photos in the partner's order (RAA-106). Preload business, category, units
# and photos: ListingPhoto::WITH_IMAGE.
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
      photos: listing.photos.map { |photo| ListingPhotoSerializer.call(photo) }
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
