module Api
  module V1
    module Me
      # "Create an account to keep this trip" (RAA-175, Guests::Register): a guest who booked
      # without an account sets a password.
      class RegistrationsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("guest") }

        def create
          render json: UserSerializer.call(Guests::Register.call(current_user, params.slice(:password)))
        end
      end
    end
  end
end
