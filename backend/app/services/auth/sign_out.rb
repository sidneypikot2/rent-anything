module Auth
  # Revokes one refresh token. An unknown token is ignored so signing out always succeeds.
  # Also closes the user's WebSockets (RAA-224): each reconnects only with an access token that
  # is still valid, so a signed-out tab's goes for good, and their other devices' come back.
  class SignOut < Base
    def initialize(refresh_token)
      @refresh_token = refresh_token
    end

    def call
      require_string!(@refresh_token, "Refresh token")
      refresh_token = RefreshToken.find_by_token(@refresh_token)
      return unless refresh_token

      refresh_token.revoke!
      UserChannel.disconnect(refresh_token.user, reconnect: true)
    end
  end
end
