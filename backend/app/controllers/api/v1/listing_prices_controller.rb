module Api
  module V1
    # What adding a listing to a trip would cost (RAA-191): public, like a stay's quote. The add
    # sheet shows it for every kind of listing.
    class ListingPricesController < ApplicationController
      def show
        render json: Bookings::PriceFor.call(params[:listing_id], params.slice(:starts_on, :ends_on, :quantity, :units, :room_guests, :pets, :pickup_time, :delivery, :return_pickup, :child_helmets))
      end
    end
  end
end
