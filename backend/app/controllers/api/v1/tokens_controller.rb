module Api
  module V1
    class TokensController < ApplicationController
      limit_requests REFRESH_RATE_LIMIT, only: :refresh

      def refresh
        render json: Auth::Refresh.call(params[:refresh_token])
      end
    end
  end
end
