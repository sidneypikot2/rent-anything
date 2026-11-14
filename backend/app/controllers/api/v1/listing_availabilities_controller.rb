module Api
  module V1
    # A listing's units free day by day (RAA-315): public, like its price.
    class ListingAvailabilitiesController < ApplicationController
      def show
        render json: Availability::Days.call(params[:listing_id], params.slice(:from, :to))
      end
    end
  end
end
