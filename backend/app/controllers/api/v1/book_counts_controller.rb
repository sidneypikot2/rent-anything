module Api
  module V1
    # How many cards each What to book section has in a place: public, like the place's page.
    class BookCountsController < ApplicationController
      def index
        area = Area.published.find_by!(slug: params[:slug])
        render json: Discovery::BookCounts.call(area, q: params[:q], from: params[:from], to: params[:to])
      end
    end
  end
end
