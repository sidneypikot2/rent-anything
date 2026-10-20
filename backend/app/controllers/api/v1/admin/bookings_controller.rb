module Api
  module V1
    module Admin
      # Every partner's bookings (RAA-141): for launch the team answers booking requests on
      # partners' behalf. Lists one status (default requested, soonest to expire first) or all
      # (newest first), at most LIMIT; accepting or declining goes through Bookings::Respond as
      # the team's answer.
      class BookingsController < ApplicationController
        LIMIT = 200
        STATUSES = Booking::STATUSES + [ "all" ]

        before_action :authenticate_user!
        before_action -> { require_role!("admin") }

        def index
          status = params[:status].presence || "requested"
          return render_bad_status unless STATUSES.include?(status)

          bookings = Booking.includes(:user, listing: %i[area category business partner])
          bookings = if status == "all"
            bookings.order(created_at: :desc, id: :desc)
          else
            bookings.where(status:).order(Arel.sql("expires_at ASC NULLS LAST"), created_at: :desc, id: :desc)
          end
          render json: bookings.limit(LIMIT).map { AdminBookingSerializer.call(_1) }
        end

        def update
          booking = Bookings::Respond.call(Booking.find(params[:id]), params[:status], actor: "admin",
            user: current_user, reason: params[:reason])
          render json: AdminBookingSerializer.call(booking)
        end

        private

        def render_bad_status
          render json: { errors: [ "Status must be one of #{STATUSES.join(', ')}" ] }, status: :unprocessable_content
        end
      end
    end
  end
end
