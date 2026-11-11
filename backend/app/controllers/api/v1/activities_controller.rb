module Api
  module V1
    class ActivitiesController < ApplicationController
      def index
        render json: Discovery::Activities.call { paginate(_1) }
      end
    end
  end
end
