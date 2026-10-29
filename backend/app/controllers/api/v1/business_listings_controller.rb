module Api
  module V1
    # A business's active listings, with what is free on some dates (RAA-191): public, like a
    # listing's page. The web app's shop pop-up reads it.
    class BusinessListingsController < ApplicationController
      def index
        render json: Businesses::ListingsFor.call(params[:business_id], params.slice(:category, :starts_on, :ends_on, :pickup_time))
      end
    end
  end
end
