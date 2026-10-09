module Api
  module V1
    # The signed-in guest's trips (RAA-64), which the cart lists: planning one, changing it,
    # merging two and asking which trip an item should go to. Another guest's trip is a 404.
    class TripsController < ApplicationController
      TRIP_PARAMS = %i[name starts_on ends_on guests].freeze

      before_action :authenticate_user!
      before_action -> { require_role!("guest") }
      before_action :set_trip, only: %i[show update destroy merge]

      def index
        trips = current_user.trips.in_cart.with_items
          .order(Arel.sql("trips.starts_on ASC NULLS LAST"), updated_at: :desc)
        destinations = TripSerializer.destination_cache
        render json: trips.map { |trip| TripSerializer.call(trip, destinations:) }
      end

      def show
        render json: TripSerializer.reloaded(@trip)
      end

      def create
        render json: TripSerializer.reloaded(Trips::Save.call(current_user.trips.build, params.slice(*TRIP_PARAMS))),
          status: :created
      end

      def update
        render json: TripSerializer.reloaded(Trips::Save.call(@trip, params.slice(*TRIP_PARAMS)))
      end

      def destroy
        @trip.destroy!
        head :no_content
      end

      def merge
        render json: TripSerializer.reloaded(Trips::Merge.call(@trip, params.slice(:into_trip_id)))
      end

      def suggestion
        suggested = Trips::SuggestFor.call(current_user, params.slice(:listing_id, :starts_on, :ends_on))
        render json: {
          trip: suggested[:trip] && TripSerializer.reloaded(suggested[:trip]),
          extends_to: suggested[:extends_to]&.transform_values(&:iso8601),
          new_trip_name: suggested[:new_trip_name]
        }
      end

      private

      def set_trip
        @trip = current_user.trips.find(params[:id])
      end
    end
  end
end
