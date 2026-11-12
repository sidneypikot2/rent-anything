module Auth
  # A short-lived access token (JWT) plus a refresh token, returned by every sign-in. A trip
  # link's session passes `session_ends_at`, when its refresh token stops working (RAA-175).
  #
  # Also a cable token (RAA-224): an AnyCable JWT naming the user, which anycable-go checks
  # itself when a WebSocket opens (sent as a sub-protocol, not in the URL), expiring with the
  # access token. anycable-go checks a token only then, so Cable::CloseExpiredJob closes the
  # user's connections when it expires, whichever token they opened with. Without an
  # anycable-go (no ANYCABLE_SECRET) there is neither.
  class IssueTokens < ApplicationService
    ACCESS_TOKEN_LIFETIME = 15.minutes

    def initialize(user, session_ends_at: nil)
      @user = user
      @session_ends_at = session_ends_at
    end

    def call
      expires_at = ACCESS_TOKEN_LIFETIME.from_now
      {
        access_token: JsonWebToken.encode(sub: @user.id.to_s, role: @user.role, expires_in: ACCESS_TOKEN_LIFETIME),
        refresh_token: RefreshToken.issue(@user, expires_at: @session_ends_at),
        cable_token: cable_token(expires_at),
        expires_in: ACCESS_TOKEN_LIFETIME.to_i,
        user: UserSerializer.call(@user)
      }
    end

    private

    def cable_token(expires_at)
      return unless UserChannel.live? && AnyCable.config.jwt_secret.present?

      Cable::CloseExpiredJob.set(wait_until: expires_at).perform_later(@user)
      AnyCable::JWT.encode({ current_user: @user }, expires_at:)
    end
  end
end
