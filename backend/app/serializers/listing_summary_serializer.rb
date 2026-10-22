# A listing as guests see it in search and on an area page (the `listing_summary` schema in
# spec/swagger_helper.rb). Never the location: the exact point is revealed only after a
# paid booking. The cover photo is the first of its ready photos (RAA-106): preload
# cover_photo. instant_book (RAA-132) shows its pill. group is where guests find it
# (Category#guest_group): preload category: :parent.
module ListingSummarySerializer
  def self.call(listing)
    {
      id: listing.id,
      title: listing.title,
      category: listing.category.name,
      group: listing.category.guest_group,
      area_slug: listing.area.slug,
      instant_book: listing.instant_book?,
      cover_photo_url: ListingPhotoSerializer.cover_url(listing)
    }
  end
end
