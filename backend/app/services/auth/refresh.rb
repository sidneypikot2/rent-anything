module Auth
  # Trades a refresh token for a new access + refresh token. A token that was already used
  # means it leaked: every session of that user is revoked — unless it was spent within
  # REUSE_GRACE, which is two tabs refreshing the same token at once, not a thief.
  class Refresh < Base
    REUSE_GRACE = 1.minute

    def initialize(refresh_token)
      @refresh_token = refresh_token
    end

    def call
      require_string!(@refresh_token, "Refresh token")

      # Returns nil instead of raising inside the transaction, so the reuse revocation
      # isn't rolled back with it.
      tokens = RefreshToken.transaction do
        record = RefreshToken.lock.find_by_token(@refresh_token)
        if record&.active?
          record.revoke!
          IssueTokens.call(record.user)
        elsif record&.revoked_at && record.revoked_at < REUSE_GRACE.ago
          record.user.refresh_tokens.active.update_all(revoked_at: Time.current)
          nil
        end
      end
      tokens || raise(NotAuthenticatedError, "Session expired")
    end
  end
end
