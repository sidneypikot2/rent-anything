module Api
  module V1
    class AreasController < ApplicationController
      def index
        render json: Discovery::Destinations.call
      end

      def show
        render json: Discovery::AreaDetail.call(Area.published.find_by!(slug: params[:slug]), pets: params[:pets] == "1")
      end
    end
  end
end
