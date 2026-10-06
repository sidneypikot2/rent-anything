module Api
  module V1
    module Partner
      # The signed-in partner's own listings (RAA-41): every status, and adding a new one.
      class ListingsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def index
          listings = current_user.listings.includes(:category, :area).order("categories.name", :title)
          render json: listings.map { |listing| PartnerListingSerializer.call(listing) }
        end

        def create
          listing_params = params.slice(:title, :description, :category_id, :address, :location, :attrs)
          render json: PartnerListingSerializer.call(Listings::Create.call(current_user, listing_params)),
            status: :created
        end
      end
    end
  end
end
