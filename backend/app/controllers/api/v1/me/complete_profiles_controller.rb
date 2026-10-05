module Api
  module V1
    module Me
      # The step after sign-up: the signed-in guest or partner sets a name and phone.
      class CompleteProfilesController < ApplicationController
        before_action :authenticate_user!

        def update
          render json: UserSerializer.call(Users::CompleteProfile.call(current_user, params.slice(:name, :phone)))
        end
      end
    end
  end
end
