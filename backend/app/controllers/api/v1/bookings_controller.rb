module Api
  module V1
    # The signed-in guest's bookings (RAA-132), a page at a time (Paginated): upcoming ones
    # first by date, then past and cancelled ones, newest first; one booking; changing one, which sends it back to the
    # partner as a request (Bookings::Change, RAA-134); cancelling one that hasn't started
    # (Bookings::Cancel); and paying for those held for payment (Payments::Pay, RAA-143), on
    # PayMongo's hosted checkout when it is set up.
    # Another guest's booking is a 404.
    class BookingsController < ApplicationController
      before_action :authenticate_user!
      before_action -> { require_role!("guest") }
      before_action :set_booking, only: %i[show update cancel]

      def index
        bookings = paginate(current_user.bookings.upcoming_first).includes(*BookingSerializer::ASSOCIATIONS)
        render json: bookings.map { BookingSerializer.call(_1) }
      end

      def show
        render json: BookingSerializer.call(@booking)
      end

      def update
        Bookings::Change.call(@booking, user: current_user, params: params.slice(:starts_on, :ends_on, :guests, :room_guests, :pets, :pickup_time, :units))
        render json: BookingSerializer.call(@booking.reload)
      end

      def cancel
        Bookings::Cancel.call(@booking, by: "guest", user: current_user, reason: params[:reason])
        render json: BookingSerializer.call(@booking.reload)
      end

      def pay
        result = Payments::Pay.call(current_user, params[:booking_ids])
        render json: { bookings: result.bookings.map { BookingSerializer.call(_1) },
                       payment: result.payment && PaymentSerializer.call(result.payment) }
      end

      private

      def set_booking
        @booking = current_user.bookings.includes(*BookingSerializer::ASSOCIATIONS).find(params[:id])
      end
    end
  end
end
