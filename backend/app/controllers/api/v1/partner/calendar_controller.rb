module Api
  module V1
    module Partner
      # The signed-in partner's calendar (RAA-118): every listing's days, blocks and bookings
      # from `from` to `to` (Availability::Calendar).
      class CalendarController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def show
          render json: PartnerCalendarSerializer.call(**Availability::Calendar.call(current_user, params.slice(:from, :to)))
        end
      end
    end
  end
end
