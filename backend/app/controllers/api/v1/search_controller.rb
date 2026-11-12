module Api
  module V1
    class SearchController < ApplicationController
      limit_browsing only: :index

      def index
        render json: Discovery::Search.call(params[:q], pets: params[:pets] == "1")
      end
    end
  end
end
