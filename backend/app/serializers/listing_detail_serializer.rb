# One active listing as a traveller sees it (the `listing_detail` schema in
# spec/swagger_helper.rb, RAA-86). Never the location or address: the exact point is
# revealed only after a paid booking. An area page's rows reuse its summary and partner name.
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
      partner_name: partner_name(listing)
    }
  end

  # The description's first non-blank line, cut to SUMMARY_LENGTH characters.
  def self.summary(listing)
    line = listing.description.lines.map(&:strip).find(&:present?)
    line.to_s.truncate(SUMMARY_LENGTH, omission: "…")
  end

  # Partners need a display name to add a listing; ones who listed before that rule show
  # their legal first name, never the surname.
  def self.partner_name(listing)
    profile = listing.partner.partner_profile
    profile&.display_name.presence || profile&.legal_first_name || "Local partner"
  end
end
