module Api
  module V1
    module Admin
      # Linking two destinations (RAA-60).
      class DestinationLinksController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("admin") }

        def create
          render json: DestinationLinks::Approve.call(params.slice(:source, :target, :kind, :weight)), status: :created
        end
      end
    end
  end
end
