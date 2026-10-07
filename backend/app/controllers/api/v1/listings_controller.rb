module Api
  module V1
    class ListingsController < ApplicationController
      def index
        render json: Discovery::ListingPins.call
      end
    end
  end
end
