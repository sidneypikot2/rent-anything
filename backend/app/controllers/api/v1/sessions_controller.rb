module Api
  module V1
    class SessionsController < ApplicationController
      limit_auth_attempts only: :create
      # A guest with no account yet, whose trips move into the account (RAA-175).
      before_action :authenticate_user, only: :create

      def create
        render json: Auth::SignIn.call(email: params[:email], password: params[:password], role: params[:role],
          current_user:)
      end

      def destroy
        Auth::SignOut.call(params[:refresh_token])
        head :no_content
      end
    end
  end
end
