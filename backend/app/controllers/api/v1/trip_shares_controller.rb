module Api
  module V1
    # A trip's view-only share link (RAA-176), which only its guest sees, makes anew or ends.
    # Another guest's trip is a 404, as in TripsController.
    class TripSharesController < ApplicationController
      before_action :authenticate_user!
      before_action -> { require_role!("guest") }
      before_action :set_trip

      def show
        render json: share(@trip.share_token)
      end

      def create
        render json: share(@trip.share!), status: :created
      end

      def destroy
        @trip.unshare!
        head :no_content
      end

      private

      def set_trip
        @trip = current_user.trips.find(params[:trip_id])
      end

      def share(token)
        { token:, path: token && "/trips/shared/#{token}" }
      end
    end
  end
end
