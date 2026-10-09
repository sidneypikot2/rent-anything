module Api
  module V1
    module Partner
      # The landmarks a tour can visit, for the partner's landmark picker (RAA-70).
      class LandmarksController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def index
          render json: Listings::LandmarkSearch.call(params.slice(:q, :area, :lat, :lng))
        end
      end
    end
  end
end
