module Api
  module V1
    class SessionsController < ApplicationController
      include RefreshCookie

      limit_auth_attempts only: :create
      # Per email too, from any IP, so one account can't be guessed at from many addresses.
      limit_requests SIGN_IN_PER_EMAIL_LIMIT, by: -> { email_key }, name: "per_email", only: :create
      # A guest with no account yet, whose trips move into the account (RAA-175).
      before_action :authenticate_user, only: :create

      def create
        render_tokens Auth::SignIn.call(email: params[:email], password: params[:password], role: params[:role],
          current_user:)
      end

      def destroy
        token = refresh_token_from_request
        # In cookie mode a cookie already gone is signed out already; otherwise a token is required.
        Auth::SignOut.call(token) unless token.nil? && refresh_cookie_mode?
        clear_refresh_cookie
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
