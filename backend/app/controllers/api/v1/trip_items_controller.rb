module Api
  module V1
    # Items in the signed-in guest's trips (RAA-64). Adding one may start a new trip, so
    # items aren't nested under a trip; adding and changing one answer with its trip.
    # Another guest's item or trip is a 404.
    class TripItemsController < ApplicationController
      before_action :authenticate_user!
      before_action -> { require_role!("guest") }
      before_action :set_item, only: %i[update destroy]

      # `items` adds several at once (RAA-187), all or none.
      def create
        fields = params.slice(:listing_id, :starts_on, :ends_on, :quantity, :room_guests, :pets, :units, :pickup_time, :guests, :trip_id, :trip_name)
        trip = params.key?(:items) ? Trips::AddItems.call(current_user, fields.merge(items: params[:items])) : Trips::AddItem.call(current_user, fields)
        render json: TripSerializer.reloaded(trip), status: :created
      end

      def update
        trip = Trips::UpdateItem.call(@item, params.slice(:starts_on, :ends_on, :quantity, :room_guests, :pets, :units, :pickup_time, :move_to_trip_id))
        render json: TripSerializer.reloaded(trip)
      end

      # A booked item is kept (RAA-132): a 422. Its trip is locked, as a checkout locks it.
      def destroy
        trip = @item.trip
        trip.with_lock do
          raise ActiveRecord::RecordInvalid, @item unless @item.destroy

          trip.follow_places_in_name!
        end

        head :no_content
      end

      private

      def set_item
        @item = TripItem.joins(:trip).where(trips: { user_id: current_user.id }).find(params[:id])
      end
    end
  end
end
