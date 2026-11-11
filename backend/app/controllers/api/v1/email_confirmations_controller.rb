module Api
  module V1
    # Confirming an account's email (RAA-214): sending the link again to the signed-in user, and
    # confirming with its token, which needs no sign-in since the link may open on another device.
    # Both are limited per IP; sending is limited per user too, so one inbox can't be flooded.
    class EmailConfirmationsController < ApplicationController
      PER_USER_LIMIT = { to: 5, within: 15.minutes }.freeze

      before_action :authenticate_user!, only: :create
      limit_auth_attempts only: %i[create verify]
      rate_limit(**PER_USER_LIMIT, by: -> { "email_confirmation:#{current_user.id}" }, with: :render_too_many_requests,
        name: "per_user", only: :create)

      def create
        Auth::SendEmailConfirmation.call(current_user)
        head :accepted
      end

      def verify
        Auth::ConfirmEmail.call(params[:token])
        head :no_content
      end
    end
  end
end
