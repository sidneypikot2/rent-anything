module Auth
  # Revokes one refresh token. An unknown token is ignored so signing out always succeeds.
  class SignOut < Base
    def initialize(refresh_token)
      @refresh_token = refresh_token
    end

    def call
      require_string!(@refresh_token, "Refresh token")
      RefreshToken.find_by_token(@refresh_token)&.revoke!
    end
  end
end
