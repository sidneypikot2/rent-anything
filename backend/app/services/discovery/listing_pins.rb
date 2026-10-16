module Discovery
  # Every active listing with its rounded location, for a guest's map (RAA-52).
  class ListingPins < ApplicationService
    def call
      Listing.active.includes(*ListingPinSerializer::INCLUDES).order(:title).map { |listing| ListingPinSerializer.call(listing) }
    end
  end
end
