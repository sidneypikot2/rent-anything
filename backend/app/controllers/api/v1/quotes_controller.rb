module Api
  module V1
    # What a stay costs (RAA-104): public, like the listing page it's shown on.
    class QuotesController < ApplicationController
      def show
        render json: Stays::QuoteFor.call(params.slice(:listing_id, :starts_on, :ends_on, :guests, :fee_ids))
      end
    end
  end
end
