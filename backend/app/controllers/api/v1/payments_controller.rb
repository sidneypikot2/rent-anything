module Api
  module V1
    # One of the signed-in guest's payments, with the bookings it covers, as the cart reads it
    # when they come back from PayMongo's checkout. A pending one is read back from PayMongo
    # first (Payments::Sync), so the guest needn't wait for the webhook; if PayMongo can't be
    # reached it is answered as it stands. Another guest's payment is a 404.
    class PaymentsController < ApplicationController
      before_action :authenticate_user!
      before_action -> { require_role!("guest") }

      def show
        payment = current_user.payments.find(params[:id])
        begin
          Payments::Sync.call(payment)
        rescue Paymongo::Error => e
          Sentry.capture_exception(e)
        end
        bookings = Booking.where(id: payment.covered_booking_ids).or(Booking.where(payment:))
          .includes(*BookingSerializer::ASSOCIATIONS).order(:starts_on, :id)
        render json: PaymentSerializer.call(payment).merge(bookings: bookings.map { BookingSerializer.call(_1) })
      end
    end
  end
end
