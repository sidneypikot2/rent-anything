module Api
  module V1
    module Partner
      # Every booking of the signed-in partner's listings (RAA-132), a page at a time (RAA-266):
      # Partners::BookingList. X-Total-Count says how many there are across every page. Each
      # comes with its listing's id and title.
      class AllBookingsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def index
          list = Partners::BookingList.call(current_user, params.slice(:status, :page, :per_page, :from, :to))
          response.set_header("X-Total-Count", list[:total].to_s)
          render json: list[:bookings].map { PartnerCalendarSerializer.booking(_1) }
        end
      end
    end
  end
end
