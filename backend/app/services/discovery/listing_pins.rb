module Discovery
  # Active listings with their rounded locations, for a guest's map (RAA-52), by title. The
  # caller pages them: the block gets the ordered relation and returns the page to show.
  class ListingPins < ApplicationService
    def call
      page = yield Listing.active.order(:title, :id)
      page.includes(*ListingPinSerializer::INCLUDES).map { |listing| ListingPinSerializer.call(listing) }
    end
  end
end
