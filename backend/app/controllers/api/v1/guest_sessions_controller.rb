module Api
  module V1
    # A guest without an account (RAA-175): made on their first add to a trip, so the trip has
    # an owner. They give name, email and phone at their first checkout.
    class GuestSessionsController < ApplicationController
      include RefreshCookie

      limit_auth_attempts only: :create

      def create
        render_tokens Auth::IssueTokens.call(User.create!(role: "guest")), status: :created
      end
    end
  end
end
