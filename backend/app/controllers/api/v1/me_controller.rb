module Api
  module V1
    class MeController < ApplicationController
      before_action :authenticate_user!

      def show
        render json: UserSerializer.call(current_user)
      end

      def update
        render json: UserSerializer.call(Users::UpdateProfile.call(current_user, params.slice(:name, :phone)))
      end
    end
  end
end
