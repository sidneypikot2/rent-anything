module Api
  module V1
    # One page of a What to book section's cards in a place, filtered: public, like the place's page.
    class BookCardsController < ApplicationController
      def index
        area = Area.published.find_by!(slug: params[:slug])
        render json: Discovery::BookCards.call(
          area, group: params[:group], page: params[:page], per_page: params[:per_page], around: params[:around],
          listing_ids: params[:listing_ids], filters: Discovery::ListingFilters::PARAMS.index_with { |key| params[key] }
        )
      end
    end
  end
end
