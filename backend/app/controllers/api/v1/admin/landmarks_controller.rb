module Api
  module V1
    module Admin
      # Publishing or unpublishing a landmark, such as one a seeding run found (RAA-168).
      class LandmarksController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("admin") }

        def update
          landmark = Landmark.find(params[:id])
          landmark.update!(status: params[:status])
          render json: AdminAreaSerializer.landmark(landmark)
        end
      end
    end
  end
end
