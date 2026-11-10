module Api
  module V1
    module Admin
      # How the app is doing, day by day (RAA-290): Admin::Overview.
      class OverviewsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("admin") }

        def show
          render json: ::Admin::Overview.call(params.slice(:days))
        end
      end
    end
  end
end
