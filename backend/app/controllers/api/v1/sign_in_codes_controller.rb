module Api
  module V1
    # Emailed one-time codes for guests (RAA-175): asking for one, which answers 202 whether
    # or not the email has an account, and signing in with it. Both are limited per IP, and
    # per email too, so one address can't be flooded or its code guessed from many IPs.
    class SignInCodesController < ApplicationController
      PER_EMAIL_LIMIT = { to: 5, within: 15.minutes }.freeze

      limit_auth_attempts only: %i[create verify]
      rate_limit(**PER_EMAIL_LIMIT, by: -> { "#{action_name}:#{email_key}" }, with: :render_too_many_requests,
        name: "per_email", only: %i[create verify])
      before_action :authenticate_user, only: :verify

      def create
        Auth::RequestSignInCode.call(params[:email])
        head :accepted
      end

      def verify
        render json: Auth::VerifySignInCode.call(params[:email], params[:code], current_user:)
      end

      private

      def email_key
        email = params[:email]
        email.is_a?(String) ? email.strip.downcase : ""
      end
    end
  end
end
