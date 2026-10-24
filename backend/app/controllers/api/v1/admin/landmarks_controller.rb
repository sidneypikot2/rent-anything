module Api
  module V1
    module Admin
      # Landmarks (places to see) in the admin console: every one, drafts included, searched by
      # name, slug or alias; adding one and changing it go through Landmarks::Save. No delete:
      # a landmark goes back to draft to leave guests' pages.
      class LandmarksController < ApplicationController
        PER_PAGE = 50

        before_action :authenticate_user!
        before_action -> { require_role!("admin") }

        def index
          landmarks = Landmarks::Search.call(params.slice(:q, :status, :area))
          page = params[:page].to_i.clamp(1, nil)
          rows = landmarks.includes(:area).offset((page - 1) * PER_PAGE).limit(PER_PAGE)
          render json: { landmarks: AdminLandmarkSerializer.rows(rows), total: landmarks.count }
        end

        def show
          render json: AdminLandmarkSerializer.call(find_landmark)
        end

        def create
          landmark = Landmarks::Save.call(Landmark.new(status: "draft"), landmark_params)
          render json: AdminLandmarkSerializer.call(landmark), status: :created
        end

        def update
          render json: AdminLandmarkSerializer.call(Landmarks::Save.call(find_landmark, landmark_params))
        end

        private

        def find_landmark
          Landmark.find_by!(slug: params[:slug])
        end

        def landmark_params
          params.slice(*Landmarks::Save::FIELDS)
        end
      end
    end
  end
end
