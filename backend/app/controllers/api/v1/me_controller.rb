module Api
  module V1
    # The signed-in user's own account.
    class MeController < ApplicationController
      before_action :authenticate_user!

      def show
        render json: current_user
      end

      def update
        render json: Users::UpdateProfile.call(current_user, request_values(:name, :phone, scope: :user))
      end
    end
  end
end
