module Auth
  # Revokes a refresh token. Unknown or already revoked tokens are ignored, so signing out
  # twice is fine. The access token runs out on its own (15 minutes).
  class SignOut < ApplicationService
    def initialize(values)
      @values = values
    end

    def call
      require_strings!(RefreshToken.new, @values, present: %i[refresh_token])
      RefreshToken.find_by_token(@values[:refresh_token])&.revoke!
    end
  end
end
