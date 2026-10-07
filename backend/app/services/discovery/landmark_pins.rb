module Discovery
  # Every published landmark with its location, for a guest's map (RAA-52).
  class LandmarkPins < ApplicationService
    def call
      Landmark.published.includes(:area).order(:name).map do |landmark|
        {
          slug: landmark.slug,
          name: landmark.name,
          area_slug: landmark.area.slug,
          location: { lat: landmark.location.y, lng: landmark.location.x }
        }
      end
    end
  end
end
