module Api
  module V1
    class TokensController < ApplicationController
      def refresh
        render json: Auth::Refresh.call(params[:refresh_token])
      end
    end
  end
end
