module Api
  module V1
    # Places to see the signed-in guest saved to their trips: "want to go", with no dates or
    # price, never booked. Saving one may start a new trip, so they aren't nested under a trip
    # (as trip items aren't); both answer with the trip. Another guest's trip or saved place is
    # a 404.
    class TripLandmarksController < ApplicationController
      before_action :authenticate_user!
      before_action -> { require_role!("guest") }

      def create
        trip = Trips::SaveLandmark.call(current_user, params.slice(:landmark_slug, :trip_id, :trip_name, :guests))
        render json: TripSerializer.reloaded(trip), status: :created
      end

      def update
        render json: TripSerializer.reloaded(Trips::PlanLandmark.call(current_user, params[:id], params.slice(:plan, :visit_on)))
      end

      def destroy
        saved = TripLandmark.joins(:trip).where(trips: { user_id: current_user.id }).find(params[:id])
        saved.destroy!
        render json: TripSerializer.reloaded(saved.trip)
      end
    end
  end
end
