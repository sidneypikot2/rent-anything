module Api
  module V1
    # One page of the businesses offering a plan step in a place (plan a whole trip): public,
    # like the place's page.
    class PlanBusinessesController < ApplicationController
      def index
        area = Area.published.find_by!(slug: params[:slug])
        render json: Discovery::PlanBusinesses.call(
          area, group: params[:group], page: params[:page], hearted: params[:hearted], from: params[:from], to: params[:to], people: params[:people],
          filters: Discovery::ListingFilters::PARAMS.index_with { |key| params[key] }
        )
      end
    end
  end
end
