module Api
  module V1
    class ExploreController < ApplicationController
      def index
        render json: Discovery::Explore.call(params.slice(:area, :landmark, :lat, :lng, :km))
      end
    end
  end
end
