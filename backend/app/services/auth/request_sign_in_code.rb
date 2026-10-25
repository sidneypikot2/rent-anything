module Auth
  # Emails a guest a one-time sign-in code (POST /sign_in_codes, RAA-175): for a lost trip
  # link, a forgotten PIN or a locked link. Says nothing about whether the email has an
  # account: the endpoint answers 202 either way, and only a guest's address gets a code.
  class RequestSignInCode < Base
    def initialize(email)
      @email = email
    end

    def call
      require_string!(@email, "Email")

      user = User.guest.find_by(email: @email.strip.downcase)
      GuestMailer.sign_in_code(user, SignInCode.issue!(user)).deliver_later if user
      nil
    end
  end
end
