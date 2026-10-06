module Api
  module V1
    module Me
      # The signed-in guest's own profile (RAA-40): legal name, phone and address. Guests
      # only; a partner's is /api/v1/partner/profile.
      class ProfilesController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("guest") }

        def show
          render json: GuestProfileSerializer.call(current_user)
        end

        def update
          profile_params = params.slice(:legal_first_name, :legal_last_name, :phone, :address)
          render json: GuestProfileSerializer.call(Guests::UpdateProfile.call(current_user, profile_params))
        end
      end
    end
  end
end
