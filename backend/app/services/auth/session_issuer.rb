module Auth
  # A signed-in session: a short-lived access token for the Authorization header and a
  # refresh token to renew it. What sign-up, sign-in and refresh all return.
  class SessionIssuer < ApplicationService
    ACCESS_TOKEN_LIFETIME = 15.minutes

    def initialize(user)
      @user = user
    end

    def call
      {
        access_token: JsonWebToken.encode(sub: @user.id, expires_in: ACCESS_TOKEN_LIFETIME),
        refresh_token: RefreshToken.issue!(@user),
        expires_in: ACCESS_TOKEN_LIFETIME.to_i,
        user: @user
      }
    end
  end
end
