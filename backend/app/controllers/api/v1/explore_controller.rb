module Api
  module V1
    class ExploreController < ApplicationController
      limit_browsing only: :index

      def index
        render json: Discovery::Explore.call(params.slice(:area, :landmark, :lat, :lng, :km, :listings))
      end
    end
  end
end
