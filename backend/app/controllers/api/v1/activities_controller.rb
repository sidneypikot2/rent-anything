module Api
  module V1
    class ActivitiesController < ApplicationController
      def index
        render json: Discovery::Activities.call
      end
    end
  end
end
