module Listings
  # A partner adds a listing (RAA-41). It starts as a draft whatever the request says:
  # going live needs an admin's approval (M5). The fields are read by ListingValues. Only a
  # partner who has passed the ID check (RAA-44) may add one.
  class Create < ApplicationService
    include ListingValues

    def initialize(partner, params)
      @partner = partner
      @params = params
      @errors = []
    end

    def call
      raise NotAuthorizedError, "Verify your ID before adding a listing" unless @partner.id_verified?

      save_listing!(@partner.listings.build(**listing_attributes, status: "draft"))
    end
  end
end
