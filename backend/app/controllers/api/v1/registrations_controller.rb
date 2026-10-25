module Api
  module V1
    class RegistrationsController < ApplicationController
      limit_auth_attempts only: :create
      # A guest with no account yet, whose trips move into the new account (RAA-175).
      before_action :authenticate_user, only: :create

      def create
        tokens = Auth::Register.call(params.permit(:email, :name, :phone, :password), role: params[:role], current_user:)
        render json: tokens, status: :created
      end
    end
  end
end
