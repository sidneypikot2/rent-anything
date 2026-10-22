module Api
  module V1
    # Booking some of the signed-in guest's trip items (RAA-132, Checkouts::Create): one
    # booking per item, answered with the checkout and its bookings as they ended up (with
    # auto-accept, held for payment). Another guest's trip is a 404.
    class CheckoutsController < ApplicationController
      before_action :authenticate_user!
      before_action -> { require_role!("guest") }

      def create
        checkout = Checkouts::Create.call(current_user, params.slice(:trip_id, :item_ids, :idempotency_key))
        bookings = checkout.bookings.includes(*BookingSerializer::ASSOCIATIONS)
        render json: { id: checkout.id, trip_id: checkout.trip_id, total_cents: checkout.total_cents,
                       bookings: bookings.map { BookingSerializer.call(_1) } }, status: :created
      end
    end
  end
end
