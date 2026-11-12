module Api
  module V1
    # A visit from a guest page (RAA-290), counted once per browser per day for the admin
    # overview. Open to anyone, so limited per IP like sign-in.
    class VisitsController < ApplicationController
      limit_requests({ to: 30, within: 1.minute }, only: :create)

      def create
        Visits::Record.call(params[:visitor_id])
        head :no_content
      end
    end
  end
end
