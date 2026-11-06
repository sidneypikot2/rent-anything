module Api
  module V1
    module Partner
      # An estimate of the signed-in partner's month, booking by booking (RAA-266): Partners::Earnings.
      class EarningsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def show
          earnings = Partners::Earnings.call(current_user, params.slice(:month))
          render json: earnings.merge(earnings.slice(:bookings, :offline_bookings).transform_values do |bookings|
            bookings.map { PartnerCalendarSerializer.booking(_1) }
          end)
        end
      end
    end
  end
end
