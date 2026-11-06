module Api
  module V1
    module Partner
      # The signed-in partner's dashboard (RAA-266): Partners::Dashboard.
      class DashboardsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def show
          render json: PartnerDashboardSerializer.call(Partners::Dashboard.call(current_user))
        end
      end
    end
  end
end
