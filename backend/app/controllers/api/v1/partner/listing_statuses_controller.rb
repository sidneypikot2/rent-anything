module Api
  module V1
    module Partner
      # The status of one of the signed-in partner's listings (RAA-115): go live, pause,
      # resume or delist it (Listings::ChangeStatus). Another partner's listing is a 404.
      class ListingStatusesController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def update
          listings = current_user.listings.includes(*PartnerListingSerializer::ASSOCIATIONS)
          listing = Listings::ChangeStatus.call(listings.find(params[:listing_id]), params[:status])
          render json: PartnerListingSerializer.call(listing)
        end
      end
    end
  end
end
