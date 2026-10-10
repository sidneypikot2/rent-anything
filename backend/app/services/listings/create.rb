module Listings
  # A partner adds a listing (RAA-41). It starts as a draft whatever the request says:
  # going live needs an admin's approval (M5). The fields are read by ListingValues. Only a
  # partner who has passed the ID check (RAA-44) and has a display name (RAA-86) may add one.
  class Create < ApplicationService
    include ListingValues

    def initialize(partner, params)
      @partner = partner
      @params = params
      @errors = []
    end

    def call
      raise NotAuthorizedError, "Verify your ID before adding a listing" unless @partner.id_verified?
      # Travellers see it on the listing (RAA-86).
      if @partner.partner_profile&.display_name.blank?
        raise NotAuthorizedError, "Add a display name to your profile before adding a listing"
      end

      save_listing!(@partner.listings.build(**listing_attributes, status: "draft"))
    end
  end
end
