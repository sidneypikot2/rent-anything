module Auth
  # Confirms an account's email with the emailed link's token (POST /email_confirmation/verify,
  # RAA-214). The token works for User::EMAIL_CONFIRMATION_LIFETIME and only while the email is
  # the one it was sent to; opening the link again keeps the first confirmation. Returns the user.
  class ConfirmEmail < Base
    def initialize(token)
      @token = token
    end

    def call
      require_string!(@token, "Token")
      user = User.find_by_token_for(:email_confirmation, @token)
      invalid!(INVALID_LINK) unless user
      user.update!(email_confirmed_at: Time.current) unless user.email_confirmed?
      user
    end
  end
end
