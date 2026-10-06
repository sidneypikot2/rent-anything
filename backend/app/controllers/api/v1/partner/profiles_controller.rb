module Api
  module V1
    module Partner
      # The signed-in partner's own profile (RAA-40): legal name, phone and business address.
      class ProfilesController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def show
          render json: PartnerProfileSerializer.call(current_user)
        end

        def update
          profile_params = params.slice(:display_name, :legal_first_name, :legal_last_name, :phone, :address)
          render json: PartnerProfileSerializer.call(Partners::UpdateProfile.call(current_user, profile_params))
        end
      end
    end
  end
end
