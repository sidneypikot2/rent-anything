module Api
  module V1
    module Admin
      # Destinations in the admin console (RAA-164): every area, drafts included, searched by
      # name, slug or alias; adding one and changing its details go through Areas::Save.
      class AreasController < ApplicationController
        PER_PAGE = 50

        before_action :authenticate_user!
        before_action -> { require_role!("admin") }

        def index
          areas = Areas::Search.call(params.slice(:q, :status, :kind))
          page = params[:page].to_i.clamp(1, nil)
          rows = areas.includes(:parent).offset((page - 1) * PER_PAGE).limit(PER_PAGE)
          render json: { areas: AdminAreaSerializer.rows(rows), total: areas.count }
        end

        def show
          render json: AdminAreaSerializer.call(find_area)
        end

        def create
          render json: AdminAreaSerializer.call(Areas::Save.call(Area.new, area_params)), status: :created
        end

        def update
          render json: AdminAreaSerializer.call(Areas::Save.call(find_area, area_params))
        end

        private

        def find_area
          Area.find_by!(slug: params[:slug])
        end

        def area_params
          params.slice(*Areas::Save::FIELDS)
        end
      end
    end
  end
end
