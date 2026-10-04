module Api
  module V1
    class MeController < ApplicationController
      before_action :authenticate_user!

      def show
        render json: UserSerializer.call(current_user)
      end
    end
  end
end
