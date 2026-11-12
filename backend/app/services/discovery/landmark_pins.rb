module Discovery
  # Published landmarks with their locations, for a guest's map (RAA-52), by name. The caller
  # pages them: the block gets the ordered relation and returns the page to show.
  class LandmarkPins < ApplicationService
    def call
      page = yield Landmark.published.order(:name, :id)
      page.includes(:area).map do |landmark|
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
