module Api
  module V1
    # Choosing a new password by email (RAA-214): asking for the link, which answers 202 whether or
    # not the email has an account, and setting the password with its token. Both are limited per
    # IP, and asking per email too, so one address can't be flooded from many IPs.
    class PasswordResetsController < ApplicationController
      PER_EMAIL_LIMIT = { to: 5, within: 15.minutes }.freeze

      # One counter per action, so asking for links doesn't use up the tries at using one.
      limit_auth_attempts only: :create, name: "request"
      limit_auth_attempts only: :update, name: "reset"
      rate_limit(**PER_EMAIL_LIMIT, by: -> { "password_reset:#{email_key}" }, with: :render_too_many_requests,
        name: "per_email", only: :create)

      def create
        Auth::RequestPasswordReset.call(params[:email], params[:role])
        head :accepted
      end

      def update
        Auth::ResetPassword.call(params[:token], params[:password])
        head :no_content
      end

      private

      def email_key
        email = params[:email]
        email.is_a?(String) ? email.strip.downcase : ""
      end
    end
  end
end
