module Auth
  # Sets a new password with the emailed link's token (PATCH /password_reset, RAA-214). The token
  # works for User::PASSWORD_RESET_LIFETIME and only until the password changes, so once. Every
  # session of the account ends (its refresh tokens are revoked), and its email counts as
  # confirmed: the link proved it. Returns the user, who then signs in with the new password.
  class ResetPassword < Base
    def initialize(token, password)
      @token = token
      @password = password
    end

    def call
      require_string!(@token, "Token")
      require_string!(@password, "Password")
      user = User.find_by_token_for(:password_reset, @token)
      invalid!(ConfirmEmail::INVALID) unless user

      User.transaction do
        user.lock!
        # Checked again under the lock: two resets sent at once must not both spend the token.
        invalid!(ConfirmEmail::INVALID) unless User.find_by_token_for(:password_reset, @token)
        user.update!(password: @password, email_confirmed_at: user.email_confirmed_at || Time.current)
        user.refresh_tokens.active.update_all(revoked_at: Time.current)
      end
      user
    end
  end
end
