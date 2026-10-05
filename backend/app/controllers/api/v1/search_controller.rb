module Api
  module V1
    class SearchController < ApplicationController
      def index
        render json: Discovery::Search.call(params[:q])
      end
    end
  end
end
