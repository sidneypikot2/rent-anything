module Api
  module V1
    class MeController < ApplicationController
      include RefreshCookie

      before_action :authenticate_user!

      def show
        render json: UserSerializer.call(current_user)
      end

      def update
        render json: UserSerializer.call(Users::UpdateProfile.call(current_user, params.slice(:name, :phone)))
      end

      def destroy
        Users::DeleteAccount.call(current_user)
        clear_refresh_cookie
        head :no_content
      end
    end
  end
end
