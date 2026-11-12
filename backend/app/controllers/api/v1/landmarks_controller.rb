module Api
  module V1
    class LandmarksController < ApplicationController
      def index
        render json: Discovery::LandmarkPins.call { paginate(_1) }
      end
    end
  end
end
