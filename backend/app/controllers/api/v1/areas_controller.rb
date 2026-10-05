module Api
  module V1
    class AreasController < ApplicationController
      def index
        render json: Discovery::Destinations.call
      end

      def show
        render json: Discovery::AreaDetail.call(Area.find_by!(slug: params[:slug]))
      end
    end
  end
end
