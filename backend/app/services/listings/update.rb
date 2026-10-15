module Listings
  # A partner changes one of their listings (RAA-46): the whole listing is sent again and
  # read by the same rules as adding one (ListingValues). It keeps its status, and a live
  # listing can't lose what going live needed (Listing#check_still_live!, RAA-115).
  class Update < ApplicationService
    include ListingValues

    def initialize(listing, params)
      @listing = listing
      @params = params
      @errors = []
    end

    def call
      @live_blockers = @listing.live_blockers
      @listing.assign_attributes(listing_attributes)
      save_listing!(@listing)
    end

    private

    def listing_partner
      @listing.partner
    end
  end
end
