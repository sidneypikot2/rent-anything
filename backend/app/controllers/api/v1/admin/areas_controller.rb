module Api
  module V1
    module Admin
      # The admin console's Areas tab (RAA-168): find a gazetteer area, seed it in the
      # background (Gazetteer::SeedArea), and see the landmarks the run found.
      class AreasController < ApplicationController
        LIMIT = 100

        before_action :authenticate_user!
        before_action -> { require_role!("admin") }

        def index
          return render_bad_filter("Kind", Area::KINDS) if params[:kind].present? && Area::KINDS.exclude?(params[:kind])
          return render_bad_filter("Status", Area::STATUSES) if params[:status].present? && Area::STATUSES.exclude?(params[:status])

          areas = AdminAreaSerializer.scope(Area.all)
          areas = areas.where(kind: params[:kind]) if params[:kind].present?
          areas = areas.where(status: params[:status]) if params[:status].present?
          if params[:q].present?
            pattern = "%#{Area.sanitize_sql_like(params[:q].to_s.strip)}%"
            areas = areas.where("areas.name ILIKE :pattern OR areas.slug ILIKE :pattern", pattern:)
          end
          render json: areas.order(:name, :id).limit(LIMIT).map { AdminAreaSerializer.call(_1) }
        end

        def seed
          area = Gazetteer::QueueSeed.call(Area.find(params[:id]))
          render json: AdminAreaSerializer.call(AdminAreaSerializer.scope(Area.all).find(area.id)), status: :accepted
        rescue Gazetteer::QueueSeed::AlreadyRunning
          render json: { error: "This area is already being seeded" }, status: :conflict
        end

        def landmarks
          landmarks = Area.find(params[:id]).landmarks.order(:name, :id)
          render json: landmarks.map { AdminAreaSerializer.landmark(_1) }
        end

        private

        def render_bad_filter(name, values)
          render json: { errors: [ "#{name} must be one of #{values.join(', ')}" ] }, status: :unprocessable_content
        end
      end
    end
  end
end
