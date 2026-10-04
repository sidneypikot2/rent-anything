module Api
  module V1
    class SessionsController < ApplicationController
      # Per IP, counted in the cache store (a null store in test).
      rate_limit to: 10, within: 3.minutes, only: :create

      def create
        render json: Auth::SignIn.call(request_values(:email, :password))
      end

      def refresh
        render json: Auth::Refresh.call(request_values(:refresh_token))
      end

      def destroy
        Auth::SignOut.call(request_values(:refresh_token))
        head :no_content
      end
    end
  end
end
