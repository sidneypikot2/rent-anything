module Auth
  # Swaps a refresh token for a new session and rotates it out. A token rotated more than
  # REUSE_GRACE ago is being replayed — by whoever stole it, or by the client it was stolen
  # from — so every session of that user ends and both have to sign in again. Within the
  # grace period it still works: two tabs whose access tokens expire together both refresh
  # with the same token, and the slower one must not sign the user out everywhere.
  # A token revoked by sign-out is simply invalid.
  class Refresh < ApplicationService
    REUSE_GRACE = 10.seconds

    def initialize(values)
      @values = values
    end

    def call
      require_strings!(RefreshToken.new, @values, present: %i[refresh_token])
      refresh_token = RefreshToken.find_by_token(@values[:refresh_token])
      raise InvalidCredentials, "Invalid refresh token" unless refresh_token

      # The lock makes concurrent refreshes with the same token take turns. Nothing raises
      # inside it: that would roll back the revocations.
      result = refresh_token.with_lock do
        if refresh_token.rotated_at && refresh_token.rotated_at > REUSE_GRACE.ago
          SessionIssuer.call(refresh_token.user)
        elsif refresh_token.rotated_at
          refresh_token.user.refresh_tokens.active.update_all(revoked_at: Time.current)
          nil
        elsif refresh_token.active?
          refresh_token.rotate!
          SessionIssuer.call(refresh_token.user)
        end
      end
      result or raise InvalidCredentials, "Invalid refresh token"
    end
  end
end
