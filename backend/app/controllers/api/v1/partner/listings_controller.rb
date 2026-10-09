module Api
  module V1
    module Partner
      # The signed-in partner's own listings (RAA-41, RAA-46): every status, adding, changing
      # and deleting one. Another partner's listing is a 404.
      class ListingsController < ApplicationController
        LISTING_PARAMS = %i[title description category_id address location attrs landmark_ids].freeze

        before_action :authenticate_user!
        before_action -> { require_role!("partner") }
        before_action :set_listing, only: %i[show update destroy]

        def index
          listings = with_landmarks.order("categories.name", :title).to_a
          destinations = PartnerLandmarkSerializer.destinations_for(listings.flat_map(&:visited_landmarks))
          render json: listings.map { |listing| PartnerListingSerializer.call(listing, destinations:) }
        end

        def show
          render json: PartnerListingSerializer.call(@listing)
        end

        def create
          listing = Listings::Create.call(current_user, listing_params)
          render json: PartnerListingSerializer.call(with_landmarks.find(listing.id)), status: :created
        end

        def update
          Listings::Update.call(@listing, listing_params)
          render json: PartnerListingSerializer.call(with_landmarks.find(@listing.id))
        end

        def destroy
          @listing.destroy!
          head :no_content
        end

        private

        def set_listing
          @listing = (action_name == "show" ? with_landmarks : current_user.listings).find(params[:id])
        end

        def with_landmarks
          current_user.listings.includes(:category, :area, visited_landmarks: :area)
        end

        def listing_params
          params.slice(*LISTING_PARAMS)
        end
      end
    end
  end
end
