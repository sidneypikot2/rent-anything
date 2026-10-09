module Api
  module V1
    # Items in the signed-in guest's trips (RAA-64). Adding one may start a new trip, so
    # items aren't nested under a trip; adding and changing one answer with its trip.
    # Another guest's item or trip is a 404.
    class TripItemsController < ApplicationController
      before_action :authenticate_user!
      before_action -> { require_role!("guest") }
      before_action :set_item, only: %i[update destroy]

      def create
        trip = Trips::AddItem.call(current_user, params.slice(:listing_id, :starts_on, :ends_on, :quantity, :trip_id))
        render json: TripSerializer.reloaded(trip), status: :created
      end

      def update
        trip = Trips::UpdateItem.call(@item, params.slice(:starts_on, :ends_on, :quantity, :move_to_trip_id))
        render json: TripSerializer.reloaded(trip)
      end

      def destroy
        @item.destroy!
        head :no_content
      end

      private

      def set_item
        @item = TripItem.joins(:trip).where(trips: { user_id: current_user.id }).find(params[:id])
      end
    end
  end
end
