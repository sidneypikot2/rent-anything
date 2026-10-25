module Api
  module V1
    # Booking some of the signed-in guest's trip items (RAA-132, Checkouts::Create): one
    # booking per item, answered with the checkout and its bookings as they ended up (with
    # auto-accept, held for payment). Another guest's trip is a 404. A guest without an
    # account gets their trip link and PIN after their first checkout (RAA-175), only here.
    class CheckoutsController < ApplicationController
      before_action :authenticate_user!
      before_action -> { require_role!("guest") }

      def create
        checkout = Checkouts::Create.call(current_user, params.slice(:trip_id, :item_ids, :idempotency_key, :contact))
        trip_link = Guests::IssueTripLink.call(current_user, checkout.trip)
        bookings = checkout.bookings.includes(*BookingSerializer::ASSOCIATIONS)
        render json: { id: checkout.id, trip_id: checkout.trip_id, total_cents: checkout.total_cents,
                       bookings: bookings.map { BookingSerializer.call(_1) }, trip_link: }, status: :created
      end
    end
  end
end
