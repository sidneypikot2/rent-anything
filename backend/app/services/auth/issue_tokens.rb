module Auth
  # A short-lived access token (JWT) plus a refresh token, returned by every sign-in.
  class IssueTokens < ApplicationService
    ACCESS_TOKEN_LIFETIME = 15.minutes

    def initialize(user)
      @user = user
    end

    def call
      {
        access_token: JsonWebToken.encode(sub: @user.id.to_s, role: @user.role, expires_in: ACCESS_TOKEN_LIFETIME),
        refresh_token: RefreshToken.issue(@user),
        expires_in: ACCESS_TOKEN_LIFETIME.to_i,
        user: UserSerializer.call(@user)
      }
    end
  end
end
