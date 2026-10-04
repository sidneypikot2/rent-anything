module Api
  module V1
    class SessionsController < ApplicationController
      def create
        render json: Auth::SignIn.call(email: params[:email], password: params[:password], role: params[:role])
      end

      def destroy
        Auth::SignOut.call(params[:refresh_token])
        head :no_content
      end
    end
  end
end
