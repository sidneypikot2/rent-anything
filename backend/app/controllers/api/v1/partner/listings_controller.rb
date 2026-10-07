module Api
  module V1
    module Partner
      # The signed-in partner's own listings (RAA-41, RAA-46): every status, adding, changing
      # and deleting one. Another partner's listing is a 404.
      class ListingsController < ApplicationController
        LISTING_PARAMS = %i[title description category_id address location attrs].freeze

        before_action :authenticate_user!
        before_action -> { require_role!("partner") }
        before_action :set_listing, only: %i[show update destroy]

        def index
          listings = current_user.listings.includes(:category, :area).order("categories.name", :title)
          render json: listings.map { |listing| PartnerListingSerializer.call(listing) }
        end

        def show
          render json: PartnerListingSerializer.call(@listing)
        end

        def create
          render json: PartnerListingSerializer.call(Listings::Create.call(current_user, listing_params)),
            status: :created
        end

        def update
          render json: PartnerListingSerializer.call(Listings::Update.call(@listing, listing_params))
        end

        def destroy
          @listing.destroy!
          head :no_content
        end

        private

        def set_listing
          @listing = current_user.listings.find(params[:id])
        end

        def listing_params
          params.slice(*LISTING_PARAMS)
        end
      end
    end
  end
end
