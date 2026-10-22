module Api
  module V1
    # The signed-in guest's bookings (RAA-132): upcoming ones first by date, then past and
    # cancelled ones, newest first; one booking; changing one, which sends it back to the
    # partner as a request (Bookings::Change, RAA-134); cancelling one that hasn't started
    # (Bookings::Cancel); and paying for those held for payment (Payments::Pay, RAA-143).
    # Another guest's booking is a 404.
    class BookingsController < ApplicationController
      before_action :authenticate_user!
      before_action -> { require_role!("guest") }
      before_action :set_booking, only: %i[show update cancel]

      def index
        bookings = current_user.bookings.includes(*BookingSerializer::ASSOCIATIONS)
        upcoming, past = bookings.partition { |booking| booking.holding? && booking.ends_on >= Date.current }
        ordered = upcoming.sort_by { [ _1.starts_on, _1.id ] } + past.sort_by { [ _1.starts_on, _1.id ] }.reverse
        render json: ordered.map { BookingSerializer.call(_1) }
      end

      def show
        render json: BookingSerializer.call(@booking)
      end

      def update
        Bookings::Change.call(@booking, user: current_user, params: params.slice(:starts_on, :ends_on, :guests))
        render json: BookingSerializer.call(@booking.reload)
      end

      def cancel
        Bookings::Cancel.call(@booking, by: "guest", user: current_user, reason: params[:reason])
        render json: BookingSerializer.call(@booking.reload)
      end

      def pay
        bookings = Payments::Pay.call(current_user, params[:booking_ids])
        render json: bookings.map { BookingSerializer.call(_1) }
      end

      private

      def set_booking
        @booking = current_user.bookings.includes(*BookingSerializer::ASSOCIATIONS).find(params[:id])
      end
    end
  end
end
