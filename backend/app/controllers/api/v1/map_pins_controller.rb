module Api
  module V1
    # The listings on the part of a place's map in view (What to book's map): public, like the place's page.
    class MapPinsController < ApplicationController
      def index
        area = Area.published.find_by!(slug: params[:slug])
        render json: Discovery::MapPins.call(
          area, bbox: params[:bbox], group: params[:group], from: params[:from], to: params[:to],
          filters: Discovery::ListingFilters::PARAMS.index_with { |key| params[key] }
        )
      end
    end
  end
end
