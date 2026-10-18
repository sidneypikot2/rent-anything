module Api
  module V1
    module Partner
      # Every booking of the signed-in partner's listings (RAA-132), newest first, at most
      # LIMIT: all of them, or those with one status (`status=requested` for the requests to
      # answer). Each comes with its listing's id and title.
      class AllBookingsController < ApplicationController
        LIMIT = 200

        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def index
          bookings = Booking.joins(:listing).where(listings: { partner_id: current_user.id }).includes(:listing)
          if params[:status].present?
            return render_bad_status unless Booking::STATUSES.include?(params[:status])

            bookings = bookings.where(status: params[:status])
          end
          render json: bookings.order(created_at: :desc, id: :desc).limit(LIMIT).map { PartnerCalendarSerializer.booking(_1) }
        end

        private

        def render_bad_status
          render json: { errors: [ "Status must be one of #{Booking::STATUSES.join(', ')}" ] }, status: :unprocessable_content
        end
      end
    end
  end
end
