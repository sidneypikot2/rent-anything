module Api
  module V1
    class LandmarksController < ApplicationController
      def index
        render json: Discovery::LandmarkPins.call
      end
    end
  end
end
