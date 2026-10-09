# A landmark in the partner's tour landmark picker and on their listing (the
# `partner_landmark` schema in spec/swagger_helper.rb), with the destination it belongs to
# (Trips::Destination: its island, otherwise its town or city).
module PartnerLandmarkSerializer
  # destinations: { area_id => destination }, from .destinations_for.
  def self.call(landmark, destinations)
    destination = destinations[landmark.area_id]
    {
      id: landmark.id,
      slug: landmark.slug,
      name: landmark.name,
      area: { slug: landmark.area.slug, name: landmark.area.name },
      destination: destination && { slug: destination.slug, name: destination.name },
      location: { lat: landmark.location.y, lng: landmark.location.x }
    }
  end

  def self.destinations_for(landmarks)
    Trips::Destination.for_areas(landmarks.map(&:area_id).uniq)
  end
end
