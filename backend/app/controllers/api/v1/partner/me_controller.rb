module Api
  module V1
    module Partner
      # The signed-in partner. Everything under /api/v1/partner is partner-only; the web
      # app's /partner guard checks this, so the rule holds even if the client is bypassed.
      class MeController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def show
          render json: UserSerializer.call(current_user)
        end
      end
    end
  end
end
