module Api
  module V1
    # Public liveness check the web app shows on its home page; also proves the
    # database (with PostGIS) answers, unlike Rails' /up.
    class HealthController < ApplicationController
      def show
        postgis = ActiveRecord::Base.connection.select_value("SELECT postgis_lib_version()")
        render json: { status: "ok", postgis: postgis }
      end
    end
  end
end
