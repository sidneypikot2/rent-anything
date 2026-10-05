module Api
  module V1
    class OauthController < ApplicationController
      limit_auth_attempts only: :create

      def create
        render json: Auth::OauthSignIn.call(provider: params[:provider], token: params[:token], role: params[:role])
      end
    end
  end
end
