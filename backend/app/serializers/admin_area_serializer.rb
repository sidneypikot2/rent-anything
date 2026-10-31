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
      photos: area.photos.map { |photo| photo(photo) },
      banner_photo: banner_photo(area.photos.first),
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
      parent: parent && { slug: parent.slug, name: parent.name },
      **seed_run(area)
    }
  end

  # The last seeding run (RAA-168), every report key present.
  def self.seed_run(area)
    report = area.seed_report
    {
      seed_status: area.seed_status, seeded_at: area.seeded_at,
      seed_report: { landmarks_added: report["landmarks_added"], enriched: report["enriched"],
        skipped: report["skipped"] || [], error: report["error"] }
    }
  end

  # One of an area's or a landmark's photos (RAA-210), with its state: until it is ready both
  # URLs are the original's, and one still uploading has no file behind them yet.
  def self.photo(photo)
    ListingPhotoSerializer.partner(photo)
  end

  # Deprecated (RAA-210): the first photo, as RAA-164's one banner, until the console uses photos.
  def self.banner_photo(photo)
    photo && { uploaded: photo.uploaded?, ready: photo.ready?, **ListingPhotoSerializer.call(photo) }
  end
end
