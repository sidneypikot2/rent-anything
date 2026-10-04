module Api
  module V1
    class SessionsController < ApplicationController
      # Per IP, counted in the cache store (a null store in test).
      rate_limit to: 10, within: 3.minutes, only: :create

      def create
        render json: Auth::SignIn.call(request_values(:email, :password))
      end

      def refresh
        render json: Auth::Refresh.call(params[:refresh_token])
      end

      # Signing out revokes the refresh token; the access token runs out on its own (15 min).
      def destroy
        RefreshToken.find_by_token(params[:refresh_token])&.revoke!
        head :no_content
      end
    end
  end
end
