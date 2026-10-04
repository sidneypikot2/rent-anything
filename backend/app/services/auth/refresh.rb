module Auth
  # Swaps a refresh token for a new session and revokes it (rotation). A token that was
  # already revoked is being replayed — by whoever stole it, or by the client it was stolen
  # from — so every session of that user ends and both have to sign in again.
  class Refresh < ApplicationService
    def initialize(token)
      @token = token
    end

    def call
      refresh_token = RefreshToken.find_by_token(@token)
      raise InvalidCredentials, "Invalid refresh token" unless refresh_token

      # The lock makes two refreshes with the same token take turns, so only one wins.
      # Nothing raises inside it: that would roll back the revocations.
      result = refresh_token.with_lock do
        if refresh_token.revoked_at
          refresh_token.user.refresh_tokens.active.update_all(revoked_at: Time.current)
          nil
        elsif refresh_token.active?
          refresh_token.revoke!
          SessionIssuer.call(refresh_token.user)
        end
      end
      result or raise InvalidCredentials, "Invalid refresh token"
    end
  end
end
