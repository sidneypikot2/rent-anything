module Api
  module V1
    class OauthController < ApplicationController
      limit_auth_attempts only: :create
      # A guest with no account yet, whose trips move into the account (RAA-175).
      before_action :authenticate_user, only: :create

      def create
        render json: Auth::OauthSignIn.call(provider: params[:provider], token: params[:token], role: params[:role],
          terms_accepted: params[:terms_accepted], current_user:)
      end
    end
  end
end
