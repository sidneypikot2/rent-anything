module Api
  module V1
    # A visit from a guest page (RAA-290), counted once per browser per day for the admin
    # overview. Open to anyone, so limited per IP like sign-in.
    class VisitsController < ApplicationController
      rate_limit to: 30, within: 1.minute, with: :render_too_many_requests, only: :create

      def create
        Visits::Record.call(params[:visitor_id])
        head :no_content
      end
    end
  end
end
