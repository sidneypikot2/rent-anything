module Api
  module V1
    module Partner
      # The bookings of one of the signed-in partner's listings (RAA-118): those ending today
      # or later, adding one taken offline (Bookings::CreateOffline) and cancelling one
      # (Bookings::ChangeStatus). Another partner's listing or booking is a 404.
      class BookingsController < ApplicationController
        BOOKING_PARAMS = %i[guest_name starts_on ends_on quantity total_cents notes].freeze

        before_action :authenticate_user!
        before_action -> { require_role!("partner") }
        before_action :set_listing

        def index
          bookings = @listing.bookings.where(ends_on: Date.current..).order(:starts_on, :id)
          render json: bookings.map { PartnerCalendarSerializer.booking(_1) }
        end

        def create
          booking = Bookings::CreateOffline.call(@listing, params.slice(*BOOKING_PARAMS))
          render json: PartnerCalendarSerializer.booking(booking), status: :created
        end

        def update
          booking = Bookings::ChangeStatus.call(@listing.bookings.find(params[:id]), params[:status])
          render json: PartnerCalendarSerializer.booking(booking)
        end

        private

        def set_listing
          @listing = current_user.listings.includes(*Availability::Calendar::ASSOCIATIONS).find(params[:listing_id])
        end
      end
    end
  end
end
