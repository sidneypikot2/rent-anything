module Api
  module V1
    # A business's own page (public, like a listing's): what it offers and about it.
    class BusinessesController < ApplicationController
      def show
        render json: Discovery::BusinessDetail.call(Business.find(params[:id]))
      end
    end
  end
end
