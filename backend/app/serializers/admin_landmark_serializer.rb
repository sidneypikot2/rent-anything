# A landmark as the admin console shows it: the `admin_landmark_row` and `admin_landmark`
# schemas in spec/swagger_helper.rb.
module AdminLandmarkSerializer
  # The list's rows, with each landmark's visiting listings counted in one query. Preload area.
  def self.rows(landmarks)
    landmarks = landmarks.to_a
    visits = ListingLandmark.visits.where(landmark_id: landmarks.map(&:id)).group(:landmark_id).count
    landmarks.map { |landmark| row(landmark, visits.fetch(landmark.id, 0)) }
  end

  def self.call(landmark)
    row(landmark, landmark.listing_landmarks.visits.count).merge(
      description: landmark.description,
      aliases: landmark.aliases,
      location: { lat: landmark.location.y, lng: landmark.location.x },
      tags: landmark.tags.order(:name).map { |tag| TagSerializer.call(tag) },
      wikidata_id: landmark.wikidata_id,
      wikidata_aliases: landmark.wikidata_aliases,
      wikidata_popularity: landmark.wikidata_popularity
    )
  end

  def self.row(landmark, visit_count)
    area = landmark.area
    {
      slug: landmark.slug, name: landmark.name, status: landmark.status,
      area: { slug: area.slug, name: area.name }, visit_count:
    }
  end
end
