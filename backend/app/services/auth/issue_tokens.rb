module Auth
  # A short-lived access token (JWT) plus a refresh token, returned by every sign-in. A trip
  # link's session passes `session_ends_at`, when its refresh token stops working (RAA-175).
  class IssueTokens < ApplicationService
    ACCESS_TOKEN_LIFETIME = 15.minutes

    def initialize(user, session_ends_at: nil)
      @user = user
      @session_ends_at = session_ends_at
    end

    def call
      {
        access_token: JsonWebToken.encode(sub: @user.id.to_s, role: @user.role, expires_in: ACCESS_TOKEN_LIFETIME),
        refresh_token: RefreshToken.issue(@user, expires_at: @session_ends_at),
        expires_in: ACCESS_TOKEN_LIFETIME.to_i,
        user: UserSerializer.call(@user)
      }
    end
  end
end
