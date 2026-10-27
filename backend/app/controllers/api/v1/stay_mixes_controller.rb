module Api
  module V1
    # Mixes of one business's room types for a party (RAA-187): public, like a stay's quote.
    class StayMixesController < ApplicationController
      def index
        render json: { mixes: Stays::MixesFor.call(params.slice(:listing_ids, :starts_on, :ends_on, :adults, :children, :infants, :pets)) }
      end
    end
  end
end
