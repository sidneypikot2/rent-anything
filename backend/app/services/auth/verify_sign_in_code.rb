module Auth
  # Signs a guest in with an emailed code (POST /sign_in_codes/verify, RAA-175). A code works
  # once, for SignInCode::LIFETIME and SignInCode::MAX_ATTEMPTS tries; a wrong, used or
  # expired one is a 401 that says no more. When the request comes from a guest who has no
  # email yet (the 409 at checkout), their trips move into this account (Guests::Absorb).
  # From the session it returns, the guest can reset their trip link and PIN.
  class VerifySignInCode < Base
    def initialize(email, code, current_user: nil)
      @email = email
      @code = code
      @current_user = current_user
    end

    def call
      require_string!(@email, "Email")
      require_string!(@code, "Code")

      # Returns nil instead of raising inside the transaction, so a wrong try's count isn't
      # rolled back with it.
      user = SignInCode.transaction do
        user = User.guest.find_by(email: @email.strip.downcase)
        record = user && user.sign_in_codes.usable.order(:created_at).lock.last
        if record&.matches?(@code.strip)
          record.update!(consumed_at: Time.current)
          user
        else
          record&.increment!(:attempts)
          nil
        end
      end
      raise NotAuthenticatedError, "That code is wrong or has expired" unless user

      Guests::Absorb.call(from: @current_user, into: user) if @current_user
      IssueTokens.call(user)
    end
  end
end
