module Api
  module V1
    class ListingsController < ApplicationController
      def index
        render json: Discovery::ListingPins.call
      end

      def show
        render json: ListingDetailSerializer.call(
          Listing.active.includes(:category, :area, :business, :units, :stay_rate, :fees).find(params[:id])
        )
      end
    end
  end
end
