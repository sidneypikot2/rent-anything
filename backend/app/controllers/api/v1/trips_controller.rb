module Api
  module V1
    # The signed-in guest's trips (RAA-64), which the cart lists: planning one, changing it,
    # merging two and asking which trip an item should go to. Another guest's trip is a 404.
    class TripsController < ApplicationController
      TRIP_PARAMS = %i[name starts_on ends_on guests].freeze

      before_action :authenticate_user!
      before_action -> { require_role!("guest") }
      before_action :set_trip, only: %i[show update destroy merge copy quote]

      # The cart, or with view=booked the Trips page (RAA-139).
      def index
        trips =
          case params[:view]
          when nil then current_user.trips.in_cart.order(Arel.sql("trips.starts_on ASC NULLS LAST"), updated_at: :desc)
          when "booked" then current_user.trips.with_bookings.order(Arel.sql("trips.starts_on DESC NULLS LAST"), :id)
          else return render json: { errors: [ "View must be booked, or left out" ] }, status: :unprocessable_content
          end
        trips = trips.with_items
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

      # A trip with bookings is kept (RAA-132): a 422. Locked, as a checkout locks it.
      def destroy
        raise ActiveRecord::RecordInvalid, @trip unless @trip.with_lock { @trip.destroy }

        head :no_content
      end

      def merge
        render json: TripSerializer.reloaded(Trips::Merge.call(@trip, params.slice(:into_trip_id)))
      end

      def copy
        copied = Trips::Copy.call(@trip, params.slice(:name, :starts_on, :guests))
        render json: { trip: TripSerializer.reloaded(copied[:trip]), skipped: copied[:skipped] }, status: :created
      end

      def quote
        render json: Trips::Quote.call(@trip)
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
