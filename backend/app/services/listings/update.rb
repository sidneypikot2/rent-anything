module Listings
  # A partner changes one of their listings (RAA-46): the whole listing is sent again and
  # read by the same rules as adding one (ListingValues). It keeps its status: edits aren't
  # re-reviewed until admin approval exists (M5).
  class Update < ApplicationService
    include ListingValues

    def initialize(listing, params)
      @listing = listing
      @params = params
      @errors = []
    end

    def call
      @listing.assign_attributes(listing_attributes)
      save_listing!(@listing)
    end
  end
end
