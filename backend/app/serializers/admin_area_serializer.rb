# A destination as the admin console shows it (RAA-164): the `admin_area_row` and `admin_area`
# schemas in spec/swagger_helper.rb.
module AdminAreaSerializer
  # The list's rows, with each area's own active listings and published landmarks counted in
  # two queries. Preload parent.
  def self.rows(areas)
    areas = areas.to_a
    ids = areas.map(&:id)
    listings = Listing.active.where(area_id: ids).group(:area_id).count
    landmarks = Landmark.published.where(area_id: ids).group(:area_id).count
    areas.map do |area|
      row(area).merge(listing_count: listings.fetch(area.id, 0), landmark_count: landmarks.fetch(area.id, 0))
    end
  end

  def self.call(area)
    row(area).merge(
      aliases: area.aliases,
      center: { lat: area.center.y, lng: area.center.x },
      psgc_code: area.psgc_code,
      tagline: area.tagline,
      description: area.description,
      getting_there: area.getting_there,
      best_time_to_visit: area.best_time_to_visit,
      tags: area.tags.order(:name).map { |tag| TagSerializer.call(tag) },
      banner_photo: banner_photo(area.banner_photo),
      wikidata_id: area.wikidata_id,
      wikidata_aliases: area.wikidata_aliases,
      wikidata_popularity: area.wikidata_popularity,
      has_boundary: !area.boundary.nil?,
      listing_count: Listing.active.where(area_id: area.id).count,
      landmark_count: area.landmarks.published.count
    )
  end

  def self.row(area)
    parent = area.parent
    {
      slug: area.slug, name: area.name, kind: area.kind, status: area.status,
      parent: parent && { slug: parent.slug, name: parent.name }
    }
  end

  def self.banner_photo(photo)
    photo && { uploaded: photo.uploaded?, ready: photo.ready?, **ListingPhotoSerializer.call(photo) }
  end
end
