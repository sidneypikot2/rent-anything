module Api
  module V1
    # A guest's trip link and PIN (RAA-175): opening it (unlock, Auth::UnlockTripLink), and
    # making a new link and PIN, which stops the old ones working and unlocks a locked link.
    class TripAccessController < ApplicationController
      limit_auth_attempts only: :unlock
      before_action :authenticate_user!, only: :rotate
      before_action -> { require_role!("guest") }, only: :rotate

      def unlock
        render json: Auth::UnlockTripLink.call(params[:token], params[:pin])
      end

      def rotate
        render json: Guests::RotateTripLink.call(current_user)
      end
    end
  end
end
